// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5.4 - Novos Upgrades: Piercing, Bank, Bomber)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();

// ===================================================================
// *** Correção de CORS Manual (Sem 'npm install') ***
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
// ===================================================================

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Isto controla a conexão websocket
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
    homingMissile:  { maxLevel: 1, baseCost: 1000 },
    piercingShots:  { maxLevel: 1, baseCost: 750 }, // NOVO
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    // Asteroides (Ataque)
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 200 },
    bomberAsteroid: { maxLevel: 1, baseCost: 400 }, // NOVO (Custo para *desbloquear*)
    // Renda
    income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] },
    galacticBank:   { maxLevel: 5, baseCost: 300 }, // NOVO
    
    // Upgrades Exclusivos
    ultimate_cluster: { maxLevel: 1, baseCost: 2500, dependency: 'tiroDuplo' },
    ultimate_laser:   { maxLevel: 1, baseCost: 2500, dependency: 'laser' },
    ultimate_barrage: { maxLevel: 1, baseCost: 2500, dependency: 'missil' },
    ultimate_swarm:   { maxLevel: 1, baseCost: 2500, dependency: 'homingMissile' }
};

function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 1000000,
        hasUltimate: false,
        bankTimer: 10, // NOVO: Timer para juros
        upgrades: {
            missil: 0,
            tiroDuplo: 0,
            laser: 0,
            homingMissile: 0,
            piercingShots: 0, // NOVO
            velocidade: 0,
            resistencia: 0,
            escudo: 0,
            enviarMais: 0,
            asteroidVida: 0,
            asteroidMaior: 0,
            sendCooldown: 0,
            bomberAsteroid: 0, // NOVO
            income: 1,
            bounty: 0,
            galacticBank: 0, // NOVO
            ultimate_cluster: 0,
            ultimate_laser: 0,
            ultimate_barrage: 0,
            ultimate_swarm: 0
        }
    };
}

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) {
        return def.baseCost[currentLevel] || Infinity;
    }
    // Custo progressivo para o Banco
    if (upgradeKey === 'galacticBank') {
        return Math.floor(def.baseCost * Math.pow(1.5, currentLevel));
    }
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}

const gameRooms = {};

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

        if (currentLevel >= def.maxLevel) return; 

        const cost = getUpgradeCost(upgradeKey, currentLevel);
        if (player.dinheiro < cost) return;

        // --- Lógica de Upgrade Exclusivo ---
        if (upgradeKey.startsWith('ultimate_')) {
            if (player.hasUltimate) return; 

            const dependencyKey = def.dependency;
            const dependencyDef = UPGRADE_DEFINITIONS[dependencyKey];
            if (player.upgrades[dependencyKey] < dependencyDef.maxLevel) {
                return; 
            }
            
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;
            player.hasUltimate = true; 
            
        } else {
            // --- Lógica de Upgrade Normal ---
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;
            
            if (upgradeKey === 'resistencia') {
                player.vidas++;
            }
        }
        
        io.to(roomId).emit('updateGameState', room.players);
    });

    // 3. Jogador foi Atingido
    socket.on('playerHit', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (player && room?.gameRunning) {
            player.vidas--;
            if (player.vidas <= 0) {
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
            const bountyMultiplier = 1.0 + (player.upgrades.bounty * 0.1);
            const totalBounty = Math.floor(bountyValue * bountyMultiplier);
            
            player.dinheiro += totalBounty;
        }
    });
    
    // 5. Asteroide Neutro Destruído
    socket.on('neutralAsteroidDestroyed', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (player) {
            player.dinheiro += 25; 
            socket.emit('gainMoney', 25);
        }
    });


    // 6. Enviar Inimigo Normal
    socket.on('sendNormalEnemy', (roomId) => {
        const CUSTO = 50;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;

            const enemyData = {
                type: 'normal',
                count: 1 + player.upgrades.enviarMais,
                health: 10 + (player.upgrades.asteroidVida * 5),
                size: 1 + player.upgrades.asteroidMaior,
                shoots: false,
                bountyValue: 10
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 7. Enviar Inimigo Atirador
    socket.on('sendShooterEnemy', (roomId) => {
        const CUSTO = 250;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            const enemyData = {
                type: 'shooter',
                count: 1, 
                health: 50 + (player.upgrades.asteroidVida * 10),
                size: 1 + player.upgrades.asteroidMaior,
                shoots: true,
                shooterLevel: player.upgrades.asteroidVida,
                bountyValue: 50
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // 8. NOVO: Enviar Asteroide-Bomba
    socket.on('sendBomberEnemy', (roomId) => {
        const CUSTO = 400; // Custo de envio
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        // Requer o upgrade (nível 1) e dinheiro
        if (!player || player.upgrades.bomberAsteroid < 1 || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            const enemyData = {
                type: 'bomber', // NOVO TIPO
                count: 1, 
                health: 100 + (player.upgrades.asteroidVida * 10), // Vida alta
                size: 1 + player.upgrades.asteroidMaior, // Afetado pelo tamanho
                shoots: false, // Não atira (só explode)
                bountyValue: 75 // Boa recompensa
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });


    // 9. Snapshot do Oponente
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });

    // 10. Desconexão
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

// Loop de Renda (ATUALIZADO para Juros)
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
            
            // Renda normal
            player.dinheiro += player.upgrades.income;
            stateChanged = true;
            
            // Lógica do Banco Galáctico (Juros)
            if (player.upgrades.galacticBank > 0) {
                player.bankTimer--;
                if (player.bankTimer <= 0) {
                    player.bankTimer = 10; // Reseta timer de 10s
                    
                    const bankLevel = player.upgrades.galacticBank;
                    const taxaJuros = 0.01 + (bankLevel * 0.005); // 1.5% a 3.5%
                    const tetoJuros = 20 + (bankLevel * 10);     // $30 a $70
                    
                    let juros = Math.floor(player.dinheiro * taxaJuros);
                    if (juros > tetoJuros) {
                        juros = tetoJuros;
                    }
                    
                    if (juros > 0) {
                        player.dinheiro += juros;
                        // Emite um evento leve para o jogador ver os juros
                        io.to(playerId).emit('showFloatingText', {
                            text: `+ $${juros} (Juros)`,
                            color: '#FFD700'
                        });
                    }
                }
            }
        }

        if (stateChanged) {
            io.to(roomId).emit('updateGameState', room.players);
        }
    }, 1000); 
}

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});