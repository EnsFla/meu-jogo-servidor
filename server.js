// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER
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
    asteroidAtira:  { maxLevel: 2, baseCost: 500 },
    // Renda
    income:         { maxLevel: 99, baseCost: 10 } // Seu upgrade de renda
};

// Objeto para armazenar o estado de todas as salas de jogo ativas
const gameRooms = {};

// Função para criar um estado de jogador padrão
function createPlayerState() {
    return {
        id: null,
        vidas: 3, // Começa com 3 vidas
        dinheiro: 0,
        // Todos os upgrades começam no nível 0, exceto a renda
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
            asteroidAtira: 0,
            // Renda
            income: 1 // Começa com 1 de renda
        }
    };
}

// Função para calcular o custo (exponencial)
function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    // Custo = base * 1.15^level (exemplo de custo exponencial)
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}


io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // 1. Jogador quer entrar ou criar uma sala
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} entrou na sala ${roomId}`);

        // Inicializa a sala se for o primeiro jogador
        if (!gameRooms[roomId]) {
            gameRooms[roomId] = {
                players: {},
                gameRunning: false,
                // ...outros estados da sala
            };
        }

        const room = gameRooms[roomId];

        // Adiciona o jogador à sala
        if (Object.keys(room.players).length < 2) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;

            // Se for o segundo jogador, inicia o jogo
            if (Object.keys(room.players).length === 2) {
                console.log(`Sala ${roomId} está cheia. Começando o jogo.`);
                room.gameRunning = true;
                // Envia para AMBOS os jogadores que o jogo começou
                io.to(roomId).emit('gameStart', room);
                
                // Inicia o "loop de renda" para esta sala
                startIncomeLoop(roomId);
            }
        } else {
            // Sala cheia, espectador (ou rejeita)
            socket.emit('roomFull');
        }

        // Envia o estado atualizado da sala para todos nela
        io.to(roomId).emit('updateGameState', room);
    });

    // 2. Jogador compra um upgrade (Lógica genérica)
    socket.on('buyUpgrade', (data) => {
        const { roomId, upgradeKey } = data;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (!player || !UPGRADE_DEFINITIONS[upgradeKey]) return; // Checagem de segurança

        const def = UPGRADE_DEFINITIONS[upgradeKey];
        const currentLevel = player.upgrades[upgradeKey];

        if (currentLevel >= def.maxLevel) {
            return; // Já está no nível máximo
        }

        const cost = getUpgradeCost(upgradeKey, currentLevel);

        if (player.dinheiro >= cost) {
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;

            // Lógica especial para upgrades
            if (upgradeKey === 'resistencia') {
                player.vidas++; // Ganha 1 vida extra permanentemente
            }
            
            // Envia o estado atualizado para todos na sala
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 3. Jogador envia um inimigo (asteroide)
    socket.on('sendEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (!player) return;

        // Custo para enviar *um* conjunto de asteroides
        const custoInimigo = 50; 

        if (player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;

            // Encontra o ID do oponente
            const opponentId = Object.keys(room.players).find(id => id !== socket.id);

            if (opponentId) {
                // Envia um objeto de dados com os upgrades do *atacante*
                io.to(opponentId).emit('receiveEnemy', {
                    count: 1 + player.upgrades.enviarMais,
                    health: 1 + player.upgrades.asteroidVida,
                    size: 1 + player.upgrades.asteroidMaior,
                    shoots: player.upgrades.asteroidAtira > 0,
                    shooterLevel: player.upgrades.asteroidAtira
                }); 
            }
            
            // Atualiza o estado para todos
            io.to(roomId).emit('updateGameState', room);
        }
    });

    // 4. Jogador perdeu uma vida (colisão)
    socket.on('playerHit', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];

         if (player) {
             player.vidas -= 1;
             
             if (player.vidas <= 0) {
                 // Jogo acabou
                 io.to(roomId).emit('gameOver', { winner: Object.keys(room.players).find(id => id !== socket.id) });
                 // Limpa a sala
                 delete gameRooms[roomId];
             } else {
                 // Apenas atualiza o estado
                 io.to(roomId).emit('updateGameState', room);
             }
         }
    });

    // 5. Jogador desconectou
    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        // Procura em qual sala o jogador estava
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                delete room.players[socket.id];
                
                // Informa ao outro jogador que o oponente saiu
                if (opponentId) {
                    io.to(opponentId).emit('opponentLeft');
                }
                
                // Limpa a sala
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
        if (!gameRooms[roomId]) { // Se a sala foi deletada (jogo acabou)
            clearInterval(intervalId);
            return;
        }

        let stateChanged = false;
        for (const playerId in room.players) {
            const player = room.players[playerId];
            player.dinheiro += player.upgrades.income; // Lê o nível de renda
            stateChanged = true;
        }

        if (stateChanged) {
            // Emite apenas o objeto 'players' para economizar banda
            io.to(roomId).emit('updateGameState', room.players);
        }

    }, 1000); // A cada 1 segundo
}


server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});