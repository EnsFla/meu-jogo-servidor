// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5 - 10 Jogadores & Novas Mecânicas)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// ----- Lógica Central do Jogo -----

const UPGRADE_DEFINITIONS = {
    // Armas
    missil:         { maxLevel: 3, baseCost: 200 },
    tiroDuplo:      { maxLevel: 1, baseCost: 150 },
    laser:          { maxLevel: 5, baseCost: 300 },
    homingShot:     { maxLevel: 3, baseCost: 400 }, // NOVO
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    // Asteroides (Ataque)
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 150 }, // NOVO
    // Renda
    income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] }
};

const gameRooms = {};

function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 0,
        lastSendTime: 0, // NOVO: Para cooldown de envio
        isAlive: true, // NOVO: Para modo 10p
        upgrades: {
            missil: 0,
            tiroDuplo: 0,
            laser: 0,
            homingShot: 0, // NOVO
            velocidade: 0,
            resistencia: 0,
            escudo: 0,
            enviarMais: 0,
            asteroidVida: 0,
            asteroidMaior: 0,
            sendCooldown: 0, // NOVO
            income: 1,
            bounty: 0
        }
    };
}

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) {
        return def.baseCost[currentLevel] || Infinity;
    }
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}

// NOVO: Calcula o cooldown de envio em milissegundos
function getPlayerSendCooldown(player) {
    // 5000ms base, -20% por nível (5s, 4s, 3s, 2s, 1s)
    return 5000 * (1 - (player.upgrades.sendCooldown * 0.2));
}


io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // 1. Entrar na Sala (Limite de 10)
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} entrou na sala ${roomId}`);

        if (!gameRooms[roomId]) {
            gameRooms[roomId] = { players: {}, gameRunning: false, intervals: {} };
        }
        const room = gameRooms[roomId];

        // ATUALIZADO: Limite de 10 jogadores
        if (Object.keys(room.players).length < 10) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;

            // ATUALIZADO: Começa o jogo se houver 2 ou mais
            if (Object.keys(room.players).length >= 2 && !room.gameRunning) {
                console.log(`Sala ${roomId} atingiu 2 jogadores. Começando o jogo.`);
                room.gameRunning = true;
                
                // Envia o 'gameStart' para todos na sala
                io.to(roomId).emit('gameStart', room);
                
                // Inicia os loops do servidor para esta sala
                room.intervals.income = startIncomeLoop(roomId);
                room.intervals.neutralSpawn = startNeutralSpawnLoop(roomId);
            }
        } else {
            socket.emit('roomFull');
        }
        io.to(roomId).emit('updateGameState', room);
    });

    // 2. Comprar Upgrade
    socket.on('buyUpgrade', (data) => {
        const { roomId, upgradeKey } = data;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (!player || !UPGRADE_DEFINITIONS[upgradeKey]) return;
        const def = UPGRADE_DEFINITIONS[upgradeKey];
        const currentLevel = player.upgrades[upgradeKey];
        if (currentLevel >= def.maxLevel) return;

        const cost = getUpgradeCost(upgradeKey, currentLevel);
        
        if (player.dinheiro >= cost) {
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;
            if (upgradeKey === 'resistencia') player.vidas++;
            
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 3. Enviar Asteroide Normal (com Cooldown e para Todos)
    socket.on('sendNormalEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;

        // NOVO: Checagem de Cooldown
        const cooldown = getPlayerSendCooldown(player);
        if (Date.now() - player.lastSendTime < cooldown) {
            return; // Falha silenciosa (spam bloqueado)
        }
        player.lastSendTime = Date.now();
        
        const custoInimigo = 50; 
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;
            
            // ATUALIZADO: Envia para todos MENOS o remetente
            io.to(roomId).except(socket.id).emit('receiveEnemy', {
                count: 1 + player.upgrades.enviarMais,
                health: 1 + player.upgrades.asteroidVida,
                size: 1 + player.upgrades.asteroidMaior,
                shoots: false,
                shooterLevel: 0,
                bountyValue: Math.floor(custoInimigo * 0.75)
            }); 
            
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 4. Enviar Asteroide Atirador (com Cooldown e para Todos)
    socket.on('sendShooterEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;

        // NOVO: Checagem de Cooldown
        const cooldown = getPlayerSendCooldown(player);
        if (Date.now() - player.lastSendTime < cooldown) {
            return;
        }
        player.lastSendTime = Date.now();

        const custoInimigo = 250; 
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;

            // ATUALIZADO: Envia para todos MENOS o remetente
            io.to(roomId).except(socket.id).emit('receiveEnemy', {
                count: 1,
                health: 5 * (1 + player.upgrades.asteroidVida),
                size: 1 + player.upgrades.asteroidMaior,
                shoots: true,
                shooterLevel: 2,
                bountyValue: Math.floor(custoInimigo * 0.75)
            });
            
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 5. Recompensa por Asteroide (Inimigo)
    socket.on('asteroidKilled', (data) => {
        const room = gameRooms[data.roomId];
        const player = room?.players[socket.id];
        if (!player) return;
        const baseBounty = data.bountyValue || 0;
        const bonus = 1 + (player.upgrades.bounty * 0.1);
        const totalBounty = Math.floor(baseBounty * bonus);
        if (totalBounty > 0) {
            player.dinheiro += totalBounty;
            io.to(data.roomId).emit('updateGameState', room);
        }
    });

    // 6. NOVO: Recompensa por Asteroide (Neutro)
    socket.on('neutralAsteroidKilled', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player) return;

        const RECOMPENSA_NEUTRA = 10; // Valor fixo
        player.dinheiro += RECOMPENSA_NEUTRA;
        io.to(roomId).emit('updateGameState', room);
    });


    // 7. Jogador Tomou Dano (Atualizado para 10p)
    socket.on('playerHit', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];
         if (player && player.isAlive) {
             player.vidas -= 1;
             
             if (player.vidas <= 0) {
                 player.isAlive = false;
                 // Informa a todos que este jogador foi eliminado
                 io.to(roomId).emit('playerDied', { id: socket.id, name: `Jogador ${socket.id.substring(0,4)}` });
                 
                 // Checa se o jogo acabou
                 checkWinCondition(roomId);
             }
             
             io.to(roomId).emit('updateGameState', room);
         }
    });

    // 8. Mini-Mapa Snapshot (Incompatível com 10p, mas mantido para 1v1)
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        
        // Em 1v1, envia para o oponente. Em 1v10, esta UI não funciona.
        const players = Object.keys(room.players);
        if (players.length === 2) {
            const opponentId = players.find(id => id !== socket.id);
            if (opponentId) io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });


    // 9. Desconexão (Atualizado para 10p)
    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                
                // Informa a todos que o jogador saiu
                io.to(roomId).emit('playerLeft', { id: socket.id });
                
                if (Object.keys(room.players).length < 2) {
                    if (room.gameRunning) {
                         // Se o jogo estava rodando, checa a vitória
                         checkWinCondition(roomId);
                    } else {
                        // Se o jogo não estava rodando e a sala está vazia, limpa
                        if (Object.keys(room.players).length === 0) {
                             cleanupRoom(roomId);
                        }
                    }
                }
                io.to(roomId).emit('updateGameState', room);
                break;
            }
        }
    });
});

// Checa se resta apenas um jogador vivo
function checkWinCondition(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;
    
    const playersAlive = Object.values(room.players).filter(p => p.isAlive);
    
    if (playersAlive.length === 1) {
        // Temos um vencedor!
        io.to(roomId).emit('gameOver', { winner: playersAlive[0].id });
        cleanupRoom(roomId);
    } else if (playersAlive.length === 0) {
        // Empate? Limpa a sala
        io.to(roomId).emit('gameOver', { winner: null }); // Empate
        cleanupRoom(roomId);
    }
}

// Limpa os loops de servidor
function cleanupRoom(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;
    
    console.log(`Limpando sala ${roomId}`);
    if (room.intervals.income) clearInterval(room.intervals.income);
    if (room.intervals.neutralSpawn) clearInterval(room.intervals.neutralSpawn);
    
    delete gameRooms[roomId];
}

// Loop de Renda
function startIncomeLoop(roomId) {
    console.log(`Iniciando loop de renda para ${roomId}`);
    return setInterval(() => {
        const room = gameRooms[roomId];
        if (!room) return;
        let stateChanged = false;
        for (const playerId in room.players) {
            const player = room.players[playerId];
            if (player.isAlive) {
                player.dinheiro += player.upgrades.income;
                stateChanged = true;
            }
        }
        if (stateChanged) {
            io.to(roomId).emit('updateGameState', room.players);
        }
    }, 1000);
}

// NOVO: Loop de Spawn Neutro
function startNeutralSpawnLoop(roomId) {
    console.log(`Iniciando loop de spawn neutro para ${roomId}`);
    return setInterval(() => {
        const room = gameRooms[roomId];
        if (!room) return;
        
        // Emite para todos na sala
        io.to(roomId).emit('spawnNeutral');
        
    }, 10000); // A cada 10 segundos
}


server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});