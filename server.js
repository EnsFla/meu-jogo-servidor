// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v2)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, restrinja isso ao seu site
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// ----- Lógica Central do Jogo -----

// Objeto central para definir custos e limites de upgrades
const UPGRADE_DEFINITIONS = {
    // Armas
    missil:         { maxLevel: 3, baseCost: 200 },
    tiroDuplo:      { maxLevel: 1, baseCost: 150 },
    laser:          { maxLevel: 5, baseCost: 300 },
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 }, // +1 vida por nível
    escudo:         { maxLevel: 5, baseCost: 100 },
    // Asteroides (Ataque)
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    // asteroidAtira foi REMOVIDO daqui
    // Renda
    income:         { maxLevel: 99, baseCost: 10 }
};

// Objeto para armazenar o estado de todas as salas de jogo ativas
const gameRooms = {};

// Função para criar um estado de jogador padrão
function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 0,
        upgrades: {
            // Armas
            missil: 0,
            tiroDuplo: 0,
            laser: 0,
            // Nave
            velocidade: 0,
            resistencia: 0,
            escudo: 0,
            // Asteroides (Ataque)
            enviarMais: 0,
            asteroidVida: 0,
            asteroidMaior: 0,
            // asteroidAtira foi REMOVIDO daqui
            // Renda
            income: 1 // Começa com 1 de renda
        }
    };
}

// Função para calcular o custo (exponencial)
function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}


io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // 1. Jogador quer entrar ou criar uma sala
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} entrou na sala ${roomId}`);

        if (!gameRooms[roomId]) {
            gameRooms[roomId] = { players: {}, gameRunning: false };
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
        io.to(roomId).emit('updateGameState', room);
    });

    // 2. Jogador compra um upgrade (Lógica genérica)
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

            if (upgradeKey === 'resistencia') {
                player.vidas++;
            }
            
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 3. Jogador envia um inimigo NORMAL
    socket.on('sendNormalEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player) return;
        
        const custoInimigo = 50; 
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;
            const opponentId = Object.keys(room.players).find(id => id !== socket.id);

            if (opponentId) {
                io.to(opponentId).emit('receiveEnemy', {
                    count: 1 + player.upgrades.enviarMais,
                    health: 1 + player.upgrades.asteroidVida,
                    size: 1 + player.upgrades.asteroidMaior,
                    shoots: false, // Normal não atira
                    shooterLevel: 0
                }); 
            }
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 4. NOVO: Jogador envia um inimigo ATIRADOR
    socket.on('sendShooterEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player) return;

        const custoInimigo = 250; // Muito mais caro
        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;
            const opponentId = Object.keys(room.players).find(id => id !== socket.id);

            if (opponentId) {
                io.to(opponentId).emit('receiveEnemy', {
                    count: 1, // Apenas 1 atirador
                    health: 5 * (1 + player.upgrades.asteroidVida), // 5x vida base
                    size: 1 + player.upgrades.asteroidMaior, // Tamanho normal de upgrade
                    shoots: true, // ESTE ATIRA
                    shooterLevel: 2 // Atira no nível 2 (rápido)
                });
            }
            io.to(roomId).emit('updateGameState', room);
        }
    });


    // 5. Jogador perdeu uma vida (colisão)
    socket.on('playerHit', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];

         if (player) {
             player.vidas -= 1;
             
             if (player.vidas <= 0) {
                 io.to(roomId).emit('gameOver', { winner: Object.keys(room.players).find(id => id !== socket.id) });
                 delete gameRooms[roomId];
             } else {
                 io.to(roomId).emit('updateGameState', room);
             }
         }
    });

    // 6. NOVO: Retransmissor do Mini-Mapa (Snapshot)
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        
        // Encontra o oponente e envia *apenas* a imagem (snapshot)
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });


    // 7. Jogador desconectou
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
                
                delete gameRooms[roomId];
                console.log(`Sala ${roomId} limpa.`);
                break;
            }
        }
    });
});

// Loop de Jogo do Servidor (apenas para renda)
function startIncomeLoop(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;

    const intervalId = setInterval(() => {
        if (!gameRooms[roomId]) {
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

    }, 1000); // A cada 1 segundo
}


server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});