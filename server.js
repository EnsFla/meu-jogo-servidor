// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5.5 - Mais Novos Upgrades!)
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
    piercingShots:  { maxLevel: 1, baseCost: 750 },
    cryoAmmo:       { maxLevel: 1, baseCost: 1200 }, // NOVO
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    matterConverter:{ maxLevel: 1, baseCost: 600 }, // NOVO (Habilidade)
    // Ataque
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 200 },
    bomberAsteroid: { maxLevel: 1, baseCost: 400 },
    incomeInhibitor:{ maxLevel: 1, baseCost: 350 }, // NOVO (Unidade)
    // Renda
    income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] },
    galacticBank:   { maxLevel: 5, baseCost: 300 },
    
    // Upgrades Exclusivos
    ultimate_cluster: { maxLevel: 1, baseCost: 2500, dependency: 'tiroDuplo' },
    ultimate_laser:   { maxLevel: 1, baseCost: 2500, dependency: 'laser' },
    ultimate_barrage: { maxLevel: 1, baseCost: 2500, dependency: 'missil' },
    ultimate_swarm:   { maxLevel: 1, baseCost: 2500, dependency: 'homingMissile' },
    ultimate_shield:  { maxLevel: 1, baseCost: 2000, dependency: 'escudo' } // NOVO
};

const MATTER_CONVERTER_COOLDOWN = 20;
const SHIELD_OVERLOAD_COOLDOWN = 15;
const INCOME_DEBUFF_DURATION = 10;
const INCOME_DEBUFF_MULTIPLIER = 0.5; // Reduz para 50%

function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 1000000,
        hasUltimate: false,
        bankTimer: 10,
        // NOVO: Cooldowns e Debuffs
        converterCooldown: 0,
        shieldOverloadCooldown: 0,
        incomeDebuffDuration: 0,
        upgrades: {
            // Armas
            missil: 0, tiroDuplo: 0, laser: 0, homingMissile: 0, piercingShots: 0, cryoAmmo: 0,
            // Nave
            velocidade: 0, resistencia: 0, escudo: 0, matterConverter: 0,
            // Ataque
            enviarMais: 0, asteroidVida: 0, asteroidMaior: 0, sendCooldown: 0, bomberAsteroid: 0, incomeInhibitor: 0,
            // Renda
            income: 1, bounty: 0, galacticBank: 0,
            // Exclusivos
            ultimate_cluster: 0, ultimate_laser: 0, ultimate_barrage: 0, ultimate_swarm: 0, ultimate_shield: 0
        }
    };
}

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) {
        return def.baseCost[currentLevel] || Infinity;
    }
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
                // NOVO: Guarda estado compartilhado da sala
                neutralAsteroids: {}, // Para o Matter Converter saber quais absorver
                inhibitorTimers: {} // Guarda IDs dos inibidores e seus timers
            };
        }

        const room = gameRooms[roomId];
        
        if (Object.keys(room.players).length < 2) {
            room.players[socket.id] = createPlayerState();
            room.players[socket.id].id = socket.id;

            if (Object.keys(room.players).length === 2) {
                console.log(`Sala ${roomId} está cheia. Começando o jogo.`);
                room.gameRunning = true;
                // Inicializa timers dos inibidores (vazio)
                const playerIds = Object.keys(room.players);
                room.inhibitorTimers[playerIds[0]] = {};
                room.inhibitorTimers[playerIds[1]] = {};
                
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
                delete gameRooms[roomId]; // Limpa a sala
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
    
    // 5. Asteroide Neutro Destruído / Convertido
    // ATUALIZADO: Recebe o ID do asteroide neutro
    socket.on('neutralAsteroidDestroyed', (data) => {
        const { roomId, asteroidId, converted } = data; // 'converted' indica se foi pelo Matter Converter
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        // Remove do estado da sala se existir
        if (room && room.neutralAsteroids[asteroidId]) {
             delete room.neutralAsteroids[asteroidId];
        }
        
        if (player) {
            player.dinheiro += 25; 
            socket.emit('gainMoney', 25);
            // Mostra texto flutuante apenas se foi convertido
            if (converted) {
                 socket.emit('showFloatingText', {
                    text: `+ $25 (Convertido)`,
                    color: '#00FF00'
                });
            }
        }
    });
    
    // NOVO: Servidor recebe info sobre asteroide neutro criado
    socket.on('neutralAsteroidCreated', (data) => {
        const { roomId, asteroidId, x, y } = data;
        const room = gameRooms[roomId];
        if (room) {
            room.neutralAsteroids[asteroidId] = { id: asteroidId, x: x, y: y };
        }
    });
    
    // NOVO: Jogador ativou Conversor de Matéria
    socket.on('activateMatterConverter', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];
         
         if (player && player.upgrades.matterConverter > 0 && player.converterCooldown <= 0) {
             player.converterCooldown = MATTER_CONVERTER_COOLDOWN; // Ativa cooldown
             
             let convertedCount = 0;
             let totalGain = 0;
             
             // Emite evento para o cliente absorver VISUALMENTE os asteroides
             // O servidor já removeu do seu estado interno
             io.to(socket.id).emit('absorbNeutrals', Object.keys(room.neutralAsteroids));
             
             // Calcula ganho e limpa estado do servidor
             for (const id in room.neutralAsteroids) {
                 convertedCount++;
                 totalGain += 25;
                 delete room.neutralAsteroids[id];
             }
             
             if (totalGain > 0) {
                 player.dinheiro += totalGain;
                 socket.emit('gainMoney', totalGain);
                 socket.emit('showFloatingText', {
                    text: `+ $${totalGain} (${convertedCount} Convertidos)`,
                    color: '#00FF00',
                    size: '1.5em'
                 });
             }
             
             io.to(roomId).emit('updateGameState', room.players); // Atualiza cooldown
         }
    });
    
    // NOVO: Jogador ativou Sobrecarga de Escudo
    socket.on('activateShieldOverload', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (player && player.upgrades.ultimate_shield > 0 && player.shieldOverloadCooldown <= 0) {
            player.shieldOverloadCooldown = SHIELD_OVERLOAD_COOLDOWN; // Ativa cooldown
            // Não precisa alterar o escudo aqui, o cliente fará isso visualmente
            // O estado será sincronizado no próximo updateGameState
            
            // Informa o outro jogador sobre o EMP (para efeitos visuais se houver)
            // socket.broadcast.to(roomId).emit('opponentUsedEMP');
            
            io.to(roomId).emit('updateGameState', room.players); // Atualiza cooldown
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
    
    // 8. Enviar Asteroide-Bomba
    socket.on('sendBomberEnemy', (roomId) => {
        const CUSTO = 400; 
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (!player || player.upgrades.bomberAsteroid < 1 || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            const enemyData = {
                type: 'bomber', 
                count: 1, 
                health: 100 + (player.upgrades.asteroidVida * 10), 
                size: 1 + player.upgrades.asteroidMaior, 
                shoots: false, 
                bountyValue: 75 
            };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // 9. NOVO: Enviar Inibidor de Renda
    socket.on('sendIncomeInhibitor', (roomId) => {
        const CUSTO = 350; // Custo de envio
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        // Requer o upgrade (nível 1) e dinheiro
        if (!player || player.upgrades.incomeInhibitor < 1 || player.dinheiro < CUSTO) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            // Gera um ID único para este inibidor
            const inhibitorId = `inhibitor_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            const enemyData = {
                type: 'inhibitor', // NOVO TIPO
                id: inhibitorId, // Envia o ID para o cliente
                count: 1, 
                health: 50, // Vida moderada
                size: 1, // Tamanho fixo
                shoots: false,
                bountyValue: 20 // Pouca recompensa
            };
            
            // Adiciona ao timer da sala (associado ao oponente)
            room.inhibitorTimers[opponentId][inhibitorId] = 15; // 15 segundos para destruir
            
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // NOVO: O cliente informa que destruiu um inibidor a tempo
    socket.on('inhibitorDestroyed', (data) => {
        const { roomId, inhibitorId } = data;
        const room = gameRooms[roomId];
        const myTimers = room?.inhibitorTimers[socket.id];
        
        if (myTimers && myTimers[inhibitorId] !== undefined) {
            delete myTimers[inhibitorId]; // Remove do timer, efeito cancelado
        }
    });


    // 10. Snapshot do Oponente
    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });

    // 11. Desconexão
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
                delete gameRooms[roomId]; // Limpa a sala inteira
                console.log(`Sala ${roomId} limpa.`);
                break;
            }
        }
    });
});

// Loop de Renda (ATUALIZADO para Cooldowns e Debuff)
function startIncomeLoop(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;

    const intervalId = setInterval(() => {
        const currentRoom = gameRooms[roomId]; // Pega a referência mais recente
        if (!currentRoom || !currentRoom.gameRunning) {
            clearInterval(intervalId);
            return;
        }

        let stateChanged = false;
        for (const playerId in currentRoom.players) {
            const player = currentRoom.players[playerId];
            if (!player) continue;

            // --- Cooldowns das Habilidades ---
            if (player.converterCooldown > 0) {
                player.converterCooldown--;
                stateChanged = true;
            }
            if (player.shieldOverloadCooldown > 0) {
                player.shieldOverloadCooldown--;
                stateChanged = true;
            }
            
            // --- Debuff de Renda ---
            let incomeMultiplier = 1.0;
            if (player.incomeDebuffDuration > 0) {
                player.incomeDebuffDuration--;
                incomeMultiplier = INCOME_DEBUFF_MULTIPLIER; // Aplica o debuff
                stateChanged = true;
            }
            
            // --- Renda Normal ---
            player.dinheiro += Math.floor(player.upgrades.income * incomeMultiplier); // Aplica multiplicador
            stateChanged = true;
            
            // --- Banco Galáctico (Juros) ---
            if (player.upgrades.galacticBank > 0) {
                player.bankTimer--;
                if (player.bankTimer <= 0) {
                    player.bankTimer = 10; 
                    const bankLevel = player.upgrades.galacticBank;
                    const taxaJuros = 0.01 + (bankLevel * 0.005); 
                    const tetoJuros = 20 + (bankLevel * 10);     
                    let juros = Math.floor(player.dinheiro * taxaJuros);
                    if (juros > tetoJuros) juros = tetoJuros;
                    if (juros > 0) {
                        player.dinheiro += juros;
                        io.to(playerId).emit('showFloatingText', {
                            text: `+ $${juros} (Juros)`, color: '#FFD700'
                        });
                    }
                }
                 stateChanged = true; // Timer mudou
            }
            
            // --- Timers dos Inibidores ---
            const inhibitorTimers = currentRoom.inhibitorTimers[playerId];
            for (const inhibitorId in inhibitorTimers) {
                 inhibitorTimers[inhibitorId]--;
                 if (inhibitorTimers[inhibitorId] <= 0) {
                     // Tempo esgotou! Aplica debuff
                     player.incomeDebuffDuration = INCOME_DEBUFF_DURATION;
                     delete inhibitorTimers[inhibitorId]; // Remove o timer
                     io.to(playerId).emit('showFloatingText', {
                         text: `RENDA REDUZIDA! (-50% por ${INCOME_DEBUFF_DURATION}s)`,
                         color: '#FF0000',
                         size: '1.3em'
                     });
                     stateChanged = true;
                 }
            }
            
        } // Fim do loop de jogadores

        if (stateChanged) {
            io.to(roomId).emit('updateGameState', currentRoom.players);
        }
    }, 1000); 
}

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});