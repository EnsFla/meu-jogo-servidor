// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5.1 - Correção Income Loop)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// ----- Lógica Central do Jogo -----

const UPGRADE_DEFINITIONS = {
    missil:         { maxLevel: 3, baseCost: 200 }, tiroDuplo:      { maxLevel: 1, baseCost: 150 },
    laser:          { maxLevel: 5, baseCost: 300 }, homingShot:     { maxLevel: 3, baseCost: 400 },
    velocidade:     { maxLevel: 3, baseCost: 50 }, resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 }, enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 }, asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 150 }, income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] }
};

const gameRooms = {};

function createPlayerState() {
    return {
        id: null, nickname: "Anon", vidas: 3, dinheiro: 0,
        lastSendTime: 0, isAlive: true, isHost: false,
        upgrades: {
            missil: 0, tiroDuplo: 0, laser: 0, homingShot: 0, velocidade: 0, resistencia: 0,
            escudo: 0, enviarMais: 0, asteroidVida: 0, asteroidMaior: 0, sendCooldown: 0,
            income: 1, bounty: 0
        }
    };
}

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) return def.baseCost[currentLevel] || Infinity;
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}

function getPlayerSendCooldown(player) {
    return 5000 * (1 - ((player.upgrades.sendCooldown || 0) * 0.2));
}

io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { roomId, nickname } = data;
        socket.join(roomId);
        console.log(`Socket ${socket.id} (Nick: ${nickname}) entrou na sala ${roomId}`);
        if (!gameRooms[roomId]) gameRooms[roomId] = { players: {}, gameRunning: false, intervals: {} };
        const room = gameRooms[roomId];
        if (room.gameRunning) { socket.emit('roomFull'); socket.leave(roomId); return; }
        if (Object.keys(room.players).length < 10) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;
            room.players[socket.id].nickname = nickname || "Anon";
            if (Object.keys(room.players).length === 1) room.players[socket.id].isHost = true;
        } else { socket.emit('roomFull'); socket.leave(roomId); }
        io.to(roomId).emit('updateGameState', room);
    });

    socket.on('startGame', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (player && player.isHost && room && !room.gameRunning) {
            console.log(`Sala ${roomId} iniciada pelo Host ${player.nickname}`);
            room.gameRunning = true;
            io.to(roomId).emit('gameStart', room);
            room.intervals.income = startIncomeLoop(roomId);
            room.intervals.neutralSpawn = startNeutralSpawnLoop(roomId);
            io.to(roomId).emit('updateGameState', room);
        }
    });

    socket.on('buyUpgrade', (data) => {
        const { roomId, upgradeKey } = data; const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (!player || !UPGRADE_DEFINITIONS[upgradeKey]) return;
        const def = UPGRADE_DEFINITIONS[upgradeKey]; const currentLevel = player.upgrades[upgradeKey] || 0;
        if (currentLevel >= def.maxLevel) return;
        const cost = getUpgradeCost(upgradeKey, currentLevel);
        if (player.dinheiro >= cost) {
            player.dinheiro -= cost; player.upgrades[upgradeKey]++;
            if (upgradeKey === 'resistencia') player.vidas++;
            io.to(roomId).emit('updateGameState', room);
        }
    });

    socket.on('sendNormalEnemy', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;
        const cooldown = getPlayerSendCooldown(player); if (Date.now() - player.lastSendTime < cooldown) return;
        const custoInimigo = 50;
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo; player.lastSendTime = Date.now();
            io.to(roomId).except(socket.id).emit('receiveEnemy', {
                count: 1 + (player.upgrades.enviarMais || 0), health: 1 + (player.upgrades.asteroidVida || 0),
                size: 1 + (player.upgrades.asteroidMaior || 0), shoots: false, shooterLevel: 0,
                bountyValue: Math.floor(custoInimigo * 0.75)
            });
            io.to(roomId).emit('updateGameState', room);
        }
    });

    socket.on('sendShooterEnemy', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (!player || !player.isAlive) return;
        const cooldown = getPlayerSendCooldown(player); if (Date.now() - player.lastSendTime < cooldown) return;
        const custoInimigo = 250;
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo; player.lastSendTime = Date.now();
            io.to(roomId).except(socket.id).emit('receiveEnemy', {
                count: 1, health: 5 * (1 + (player.upgrades.asteroidVida || 0)),
                size: 1 + (player.upgrades.asteroidMaior || 0), shoots: true, shooterLevel: 2,
                bountyValue: Math.floor(custoInimigo * 0.75)
            });
            io.to(roomId).emit('updateGameState', room);
        }
    });

    socket.on('asteroidKilled', (data) => {
        const room = gameRooms[data.roomId]; const player = room?.players[socket.id]; if (!player) return;
        const baseBounty = data.bountyValue || 0; const bonus = 1 + ((player.upgrades.bounty || 0) * 0.1);
        const totalBounty = Math.floor(baseBounty * bonus);
        if (totalBounty > 0) { player.dinheiro += totalBounty; io.to(data.roomId).emit('updateGameState', room); }
    });

    socket.on('neutralAsteroidKilled', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player) return;
        const RECOMPENSA_NEUTRA = 10; player.dinheiro += RECOMPENSA_NEUTRA; io.to(roomId).emit('updateGameState', room);
    });

    socket.on('playerHit', (roomId) => {
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
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

    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const wasHost = room.players[socket.id].isHost;
                delete room.players[socket.id];
                io.to(roomId).emit('playerLeft', { id: socket.id });
                if (wasHost && !room.gameRunning) {
                    const players = Object.values(room.players);
                    if (players.length > 0) players[0].isHost = true;
                }
                if (room.gameRunning) checkWinCondition(roomId);
                else if (Object.keys(room.players).length === 0) cleanupRoom(roomId);
                io.to(roomId).emit('updateGameState', room);
                break;
            }
        }
    });
});

function checkWinCondition(roomId) {
    const room = gameRooms[roomId]; if (!room) return;
    const playersAlive = Object.values(room.players).filter(p => p.isAlive);
    if (room.gameRunning && playersAlive.length <= 1) {
        let winnerId = playersAlive.length === 1 ? playersAlive[0].id : null;
        io.to(roomId).emit('gameOver', { winner: winnerId });
        cleanupRoom(roomId);
    }
}

function cleanupRoom(roomId) {
    const room = gameRooms[roomId]; if (!room) return;
    console.log(`Limpando sala ${roomId}`);
    if (room.intervals.income) clearInterval(room.intervals.income);
    if (room.intervals.neutralSpawn) clearInterval(room.intervals.neutralSpawn);
    delete gameRooms[roomId];
}

// Loop de Renda (CORRIGIDO)
function startIncomeLoop(roomId) {
    console.log(`Iniciando loop de renda para ${roomId}`);
    const intervalId = setInterval(() => {
        // CORREÇÃO: Verifica se a sala ainda existe usando gameRooms[roomId]
        if (!gameRooms[roomId]) {
            clearInterval(intervalId); // Limpa ESTE intervalo
            console.log(`Loop de renda para ${roomId} interrompido (sala não existe).`); // Log
            return;
        }
        const room = gameRooms[roomId]; // Pega a sala novamente
        let stateChanged = false;
        for (const playerId in room.players) {
            const player = room.players[playerId];
            if (player.isAlive) {
                player.dinheiro += (player.upgrades.income || 1);
                stateChanged = true;
            }
        }
        if (stateChanged) {
            io.to(roomId).emit('updateGameState', room.players); // Envia só players
        }
    }, 1000);
    return intervalId;
}

// Loop de Spawn Neutro (CORRIGIDO)
function startNeutralSpawnLoop(roomId) {
    console.log(`Iniciando loop de spawn neutro para ${roomId}`);
    const intervalId = setInterval(() => {
        // CORREÇÃO: Verifica se a sala ainda existe usando gameRooms[roomId]
        if (!gameRooms[roomId]) {
            clearInterval(intervalId); // Limpa ESTE intervalo
            console.log(`Loop de spawn neutro para ${roomId} interrompido (sala não existe).`); // Log
            return;
        }
        io.to(roomId).emit('spawnNeutral');
    }, 10000);
    return intervalId;
}

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});