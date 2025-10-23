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
// Objeto para armazenar o estado de todas as salas de jogo ativas
const gameRooms = {};

// Função para criar um estado de jogador padrão
function createPlayerState() {
    return {
        id: null,
        vidas: 3, // Começa com 3 vidas
        dinheiro: 0,
        income: 1, // Ganha 1 de dinheiro por segundo (exemplo)
        // ...outros estados, como nave.x, nave.y se precisar sincronizar
    };
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

    // 2. Jogador compra um upgrade de renda
    socket.on('buyIncomeUpgrade', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];

        if (player) {
            const custoUpgrade = Math.floor(10 * Math.pow(1.1, player.income)); // Custo exponencial
            if (player.dinheiro >= custoUpgrade) {
                player.dinheiro -= custoUpgrade;
                player.income += 1;
                
                // Envia o estado atualizado para todos na sala
                io.to(roomId).emit('updateGameState', room);
            }
        }
    });

    // 3. Jogador envia um inimigo (asteroide)
    socket.on('sendEnemy', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        const custoInimigo = 50; // Custo fixo para enviar um inimigo

        if (player && player.dinheiro >= custoInimigo) {
            player.dinheiro -= custoInimigo;

            // Encontra o ID do oponente
            const opponentId = Object.keys(room.players).find(id => id !== socket.id);

            if (opponentId) {
                // Envia uma mensagem APENAS para o oponente
                io.to(opponentId).emit('receiveEnemy'); 
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
                delete room.players[socket.id];
                // Informa ao outro jogador que o oponente saiu
                io.to(roomId).emit('opponentLeft');
                // Limpa a sala
                delete gameRooms[roomId];
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
            room.players[playerId].dinheiro += room.players[playerId].income;
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