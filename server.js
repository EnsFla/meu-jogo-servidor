// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v4)
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
    homingMissile:  { maxLevel: 1, baseCost: 1000 }, // NOVO
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    // Asteroides (Ataque)
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 200 }, // NOVO
    // Renda
    income:         { maxLevel: 99, baseCost: 10 },
    // NOVO: Recompensa com custo progressivo fixo
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] } // 5 níveis
};

const gameRooms = {};

function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 0,
        upgrades: {
            missil: 0,
            tiroDuplo: 0,
            laser: 0,
            homingMissile: 0, // NOVO
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

// ATUALIZADO: getUpgradeCost agora lida com custos em array
function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    
    // Se baseCost for um array, use-o
    if (Array.isArray(def.baseCost)) {
        return def.baseCost[currentLevel] || Infinity; // Retorna o custo do nível atual ou Infinito se maxed
    }
    
    // Senão, use a fórmula exponencial
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}


io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // 1. Entrar na Sala
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} entrou na sala ${roomId}`);

        if (!gameRooms[roomId]) {
            gameRooms[roomId] = {
                players: {},
                gameRunning: false
            };
        }

        const room = gameRooms[roomId];
        
        if (Object.keys(room.players).length < 2) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;

            if (Object.keys(room.players).length === 2) {
                console.log(`Sala ${roomId} está cheia. Começando o jogo.`);
                room.gameRunning = true;
                io.to(roomId).emit('gameStart', room);
                startIncomeLoop(roomId);
            }
        } else {
            socket.emit('roomFull');
        }
        
        io.to(roomId).emit('updateGameState', room.players);
    });

    // 2. Comprar Upgrade
    socket.on('buyUpgrade', (data) => {
        const { roomId, upgradeKey } = data;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];

        if (!player || !UPGRADE_DEFINITIONS[upgradeKey]) return;
        
        const def = UPGRADE_DEFINITIONS[upgradeKey];
        const currentLevel = player.upgrades[upgradeKey];

        if (currentLevel >= def.maxLevel) return; // Já está no máximo

        const cost = getUpgradeCost(upgradeKey, currentLevel);

        if (player.dinheiro >= cost) {
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;
            
            // Lógica especial para upgrades
            if (upgradeKey === 'resistencia') {
                player.vidas++; // Ganha 1 vida ao comprar
            }

            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 3. Jogador foi Atingido
    socket.on('playerHit', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (player && room.gameRunning) {
            player.vidas--;
            if (player.vidas <= 0) {
                // Fim de jogo
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                io.to(roomId).emit('gameOver', { winner: opponentId, loser: socket.id });
                room.gameRunning = false;
                delete gameRooms[roomId];
            } else {
                io.to(roomId).emit('updateGameState', room.players);
            }
        }
    });

    // 4. Asteroide Destruído (para Bounty)
    socket.on('asteroidDestroyed', (data) => {
        const { roomId, bountyValue } = data;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (player) {
            // Calcula o bônus de bounty (10% por nível)
            const bountyMultiplier = 1.0 + (player.upgrades.bounty * 0.1);
            const totalBounty = Math.floor(bountyValue * bountyMultiplier);
            
            player.dinheiro += totalBounty;
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 5. Enviar Inimigo Normal
    socket.on('sendNormalEnemy', (roomId) => {
        const CUSTO = 50;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;

            const enemyData = {
                count: 1 + player.upgrades.enviarMais,
                health: 10 + (player.upgrades.asteroidVida * 5),
                size: 1 + player.upgrades.asteroidMaior,
                shoots: false,
                bountyValue: 10 // Recompensa base
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 6. Enviar Inimigo Atirador
    socket.on('sendShooterEnemy', (roomId) => {
        const CUSTO = 250;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            const enemyData = {
                count: 1, // Atiradores não são afetados por 'enviarMais'
                health: 50 + (player.upgrades.asteroidVida * 10),
                size: 1 + player.upgrades.asteroidMaior,
                shoots: true,
                shooterLevel: player.upgrades.asteroidVida, // Dano do tiro escala com a vida
                bountyValue: 50 // Recompensa base
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 7. NOVO: Asteroide Neutro Destruído
    socket.on('neutralAsteroidDestroyed', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (player) {
            player.dinheiro += 25; // Recompensa fixa
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 8. Snapshot do Oponente
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });

    // 9. Desconexão
    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                delete room.players[socket.id];
                if (opponentId) {
                    io.to(opponentId).emit('opponentLeft');
                }
                // Limpa a sala se o jogo acabou ou o oponente saiu
                delete gameRooms[roomId];
                console.log(`Sala ${roomId} limpa.`);
                break;
            }
        }
    });
});

// Loop de Renda
function startIncomeLoop(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;

    const intervalId = setInterval(() => {
        if (!gameRooms[roomId] || !gameRooms[roomId].gameRunning) {
            clearInterval(intervalId);
            return;
        }

        let stateChanged = false;
        for (const playerId in room.players) {
            const player = room.players[playerId];
            player.dinheiro += player.upgrades.income;
            stateChanged = true;
        }

        if (stateChanged) {
            io.to(roomId).emit('updateGameState', room.players);
        }
    }, 1000); // Renda a cada segundo
}

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});