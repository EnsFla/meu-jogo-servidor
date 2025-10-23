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
        nickname: "Anon", // NOVO
        vidas: 3,
        dinheiro: 0,
        lastSendTime: 0, // NOVO: Para cooldown de envio
        isAlive: true, // NOVO: Para modo 10p
        isHost: false, // NOVO: Para botão de start
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

    // 1. Entrar na Sala (ATUALIZADO com Nickname e Host)
    socket.on('joinRoom', (data) => {
        const { roomId, nickname } = data;
        socket.join(roomId);
        console.log(`Socket ${socket.id} (Nick: ${nickname}) entrou na sala ${roomId}`);

        if (!gameRooms[roomId]) {
            gameRooms[roomId] = { players: {}, gameRunning: false, intervals: {} };
        }
        const room = gameRooms[roomId];

        // Se o jogo já começou, entra como espectador (lógica não implementada, apenas rejeita)
        if (room.gameRunning) {
             socket.emit('roomFull'); // Reutilizando evento
             socket.leave(roomId);
             return;
        }

        // ATUALIZADO: Limite de 10 jogadores
        if (Object.keys(room.players).length < 10) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;
            room.players[socket.id].nickname = nickname || "Anon";

            // O primeiro jogador se torna o Host
            if (Object.keys(room.players).length === 1) {
                room.players[socket.id].isHost = true;
            }

            // REMOVIDO: Auto-start
            
        } else {
            socket.emit('roomFull');
            socket.leave(roomId);
        }
        
        // Envia o estado do lobby para todos
        io.to(roomId).emit('updateGameState', room);
    });

    // 2. NOVO: Host inicia o jogo
    socket.on('startGame', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        // Só o Host pode começar, e só se o jogo não começou
        if (player && player.isHost && room && !room.gameRunning) {
            console.log(`Sala ${roomId} iniciada pelo Host ${player.nickname}`);
            room.gameRunning = true;
            
            // Envia o 'gameStart' para todos na sala
            io.to(roomId).emit('gameStart', room);
            
            // Inicia os loops do servidor para esta sala
            room.intervals.income = startIncomeLoop(roomId);
            room.intervals.neutralSpawn = startNeutralSpawnLoop(roomId);
        }
    });

    // 3. Comprar Upgrade
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

    // 4. Enviar Asteroide Normal (com Cooldown e para Todos)
    socket.on('sendNormalEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;

        // Checagem de Cooldown
        const cooldown = getPlayerSendCooldown(player);
        if (Date.now() - player.lastSendTime < cooldown) {
            return; // Falha silenciosa (spam bloqueado)
        }
        
        const custoInimigo = 50; 
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;
            player.lastSendTime = Date.now(); // Reseta o cooldown SÓ se tiver sucesso
            
            // Envia para todos MENOS o remetente
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

    // 5. Enviar Asteroide Atirador (com Cooldown e para Todos)
    socket.on('sendShooterEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;

        // Checagem de Cooldown
        const cooldown = getPlayerSendCooldown(player);
        if (Date.now() - player.lastSendTime < cooldown) {
            return;
        }

        const custoInimigo = 250; 
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;
            player.lastSendTime = Date.now(); // Reseta o cooldown SÓ se tiver sucesso
            
            // Envia para todos MENOS o remetente
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

    // 6. Recompensa por Asteroide (Inimigo)
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

    // 7. Recompensa por Asteroide (Neutro)
    socket.on('neutralAsteroidKilled', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player) return;
        const RECOMPENSA_NEUTRA = 10;
        player.dinheiro += RECOMPENSA_NEUTRA;
        io.to(roomId).emit('updateGameState', room);
    });

    // 8. Jogador Tomou Dano (Atualizado para 10p)
    socket.on('playerHit', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];
         if (player && player.isAlive) {
             player.vidas -= 1;
             
             if (player.vidas <= 0) {
                 player.isAlive = false;
                 io.to(roomId).emit('playerDied', { id: socket.id, nickname: player.nickname });
                 checkWinCondition(roomId);
             }
             
             io.to(roomId).emit('updateGameState', room);
         }
    });

    // 9. Mini-Mapa Snapshot (Mantido para 1v1)
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        const players = Object.values(room.players);
        if (players.length === 2) {
            const opponent = players.find(p => p.id !== socket.id);
            if (opponent) io.to(opponent.id).emit('receiveSnapshot', snapshot);
        }
    });

    // 10. Desconexão (Atualizado para 10p e Host)
    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const wasHost = room.players[socket.id].isHost;
                delete room.players[socket.id];
                
                io.to(roomId).emit('playerLeft', { id: socket.id });

                // Se o Host saiu, elege um novo Host (o jogador mais antigo)
                if (wasHost && !room.gameRunning) { // Só se o jogo não começou
                    const players = Object.values(room.players);
                    if (players.length > 0) {
                        players[0].isHost = true;
                    }
                }
                
                // Se o jogo estava rodando, checa a vitória
                if (room.gameRunning) {
                     checkWinCondition(roomId);
                } else {
                    // Se o jogo não estava rodando e a sala está vazia, limpa
                    if (Object.keys(room.players).length === 0) {
                         cleanupRoom(roomId);
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
    
    // Se o jogo estava rodando e resta 1 ou 0 jogadores
    if (room.gameRunning && playersAlive.length <= 1) {
        let winnerId = null;
        if (playersAlive.length === 1) {
             winnerId = playersAlive[0].id;
        }
        
        io.to(roomId).emit('gameOver', { winner: winnerId });
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
        if (!room) { clearInterval(this); return; }
        
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

// Loop de Spawn Neutro
function startNeutralSpawnLoop(roomId) {
    console.log(`Iniciando loop de spawn neutro para ${roomId}`);
    return setInterval(() => {
        const room = gameRooms[roomId];
        if (!room) { clearInterval(this); return; }
        
        io.to(roomId).emit('spawnNeutral');
        
    }, 10000); // A cada 10 segundos
}


server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});