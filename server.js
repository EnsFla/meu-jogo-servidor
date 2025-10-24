// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5.6 - Prism, Jump, Smuggler, Mines)
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
    cryoAmmo:       { maxLevel: 1, baseCost: 1200 },
    // Nave
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    matterConverter:{ maxLevel: 1, baseCost: 600 },
    hyperspaceJump: { maxLevel: 1, baseCost: 800 }, // NOVO (Habilidade)
    // Ataque
    enviarMais:     { maxLevel: 10, baseCost: 75 },
    asteroidVida:   { maxLevel: 10, baseCost: 100 },
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },
    sendCooldown:   { maxLevel: 5, baseCost: 200 },
    bomberAsteroid: { maxLevel: 1, baseCost: 400 },
    incomeInhibitor:{ maxLevel: 1, baseCost: 350 },
    minefieldDeploy:{ maxLevel: 1, baseCost: 200 }, // NOVO (Unidade)
    // Renda
    income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] },
    galacticBank:   { maxLevel: 5, baseCost: 300 },
    starSmuggler:   { maxLevel: 1, baseCost: 500 }, // NOVO
    
    // Upgrades Exclusivos
    ultimate_cluster: { maxLevel: 1, baseCost: 2500, dependency: 'tiroDuplo' },
    ultimate_laser:   { maxLevel: 1, baseCost: 2500, dependency: 'laser' },
    ultimate_prism:   { maxLevel: 1, baseCost: 1500, dependency: 'ultimate_laser' }, // NOVO (Exclusivo do Exclusivo)
    ultimate_barrage: { maxLevel: 1, baseCost: 2500, dependency: 'missil' },
    ultimate_swarm:   { maxLevel: 1, baseCost: 2500, dependency: 'homingMissile' },
    ultimate_shield:  { maxLevel: 1, baseCost: 2000, dependency: 'escudo' }
};

const MATTER_CONVERTER_COOLDOWN = 20;
const SHIELD_OVERLOAD_COOLDOWN = 15;
const HYPERSPACE_JUMP_COOLDOWN = 10; // NOVO
const INCOME_DEBUFF_DURATION = 10;
const INCOME_DEBUFF_MULTIPLIER = 0.5;
const SMUGGLER_LOOT_CHANCE = 0.1; // 10% chance
const SMUGGLER_LOOT_MIN = 50;
const SMUGGLER_LOOT_MAX = 100;

function createPlayerState() {
    return {
        id: null,
        vidas: 3,
        dinheiro: 100000000,
        hasUltimate: false,
        bankTimer: 10,
        converterCooldown: 0,
        shieldOverloadCooldown: 0,
        hyperspaceCooldown: 0, // NOVO
        incomeDebuffDuration: 0,
        mineCount: 0, // NOVO: Conta minas ativas enviadas
        upgrades: {
            // Armas
            missil: 0, tiroDuplo: 0, laser: 0, homingMissile: 0, piercingShots: 0, cryoAmmo: 0,
            // Nave
            velocidade: 0, resistencia: 0, escudo: 0, matterConverter: 0, hyperspaceJump: 0,
            // Ataque
            enviarMais: 0, asteroidVida: 0, asteroidMaior: 0, sendCooldown: 0, bomberAsteroid: 0, incomeInhibitor: 0, minefieldDeploy: 0,
            // Renda
            income: 1, bounty: 0, galacticBank: 0, starSmuggler: 0,
            // Exclusivos
            ultimate_cluster: 0, ultimate_laser: 0, ultimate_prism: 0, ultimate_barrage: 0, ultimate_swarm: 0, ultimate_shield: 0
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
                neutralAsteroids: {},
                inhibitorTimers: {},
                mines: {} // NOVO: Guarda minas ativas { ownerId: { mineId: { x, y, timer } } }
            };
        }

        const room = gameRooms[roomId];
        
        if (Object.keys(room.players).length < 2) {
            const newPlayer = createPlayerState();
            newPlayer.id = socket.id;
            room.players[socket.id] = newPlayer;
            
            // Inicializa sub-objetos para o novo jogador
             room.inhibitorTimers[socket.id] = {};
             room.mines[socket.id] = {}; // Inicializa minas enviadas por este jogador

            if (Object.keys(room.players).length === 2) {
                console.log(`Sala ${roomId} está cheia. Começando o jogo.`);
                room.gameRunning = true;
                
                // Garante que o segundo jogador também tenha sub-objetos inicializados
                const otherPlayerId = Object.keys(room.players).find(id => id !== socket.id);
                if (otherPlayerId && !room.inhibitorTimers[otherPlayerId]) {
                    room.inhibitorTimers[otherPlayerId] = {};
                }
                 if (otherPlayerId && !room.mines[otherPlayerId]) {
                    room.mines[otherPlayerId] = {};
                }
                
                io.to(roomId).emit('gameStart', room);
                startIncomeLoop(roomId);
            }
        } else {
            socket.emit('roomFull');
        }
        
        io.to(roomId).emit('updateGameState', room.players);
    });

    // 2. Comprar Upgrade (ATUALIZADO para ultimate_prism)
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
            // Prisma Divisor requer ultimate_laser E não ter outro ultimate
             if (upgradeKey === 'ultimate_prism') {
                 if (player.upgrades.ultimate_laser < 1) return; // Requer Laser Purgatório
                 // Não precisa checar hasUltimate aqui, pois só pode ter ultimate_laser se não tiver outro
             } else if (player.hasUltimate) {
                 return; // Já possui um outro exclusivo (não Prisma)
             }

            const dependencyKey = def.dependency;
            const dependencyDef = UPGRADE_DEFINITIONS[dependencyKey];
            if (player.upgrades[dependencyKey] < dependencyDef.maxLevel) {
                return; 
            }
            
            player.dinheiro -= cost;
            player.upgrades[upgradeKey]++;
            // Só trava 'hasUltimate' se não for o Prisma (que é um adicional)
            if (upgradeKey !== 'ultimate_prism') {
                player.hasUltimate = true;
            }
            
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
    
    // 5. Asteroide Neutro Destruído / Convertido (ATUALIZADO para Smuggler)
    socket.on('neutralAsteroidDestroyed', (data) => {
        const { roomId, asteroidId, converted, x, y } = data; // Recebe posição
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (room && room.neutralAsteroids[asteroidId]) {
             delete room.neutralAsteroids[asteroidId];
        }
        
        if (player) {
            let gain = 25;
            let message = converted ? `+ $${gain} (Convertido)` : `+ $${gain}`;
            let color = converted ? '#00FF00' : 'white';
            
            // Lógica do Contrabandista
            if (!converted && player.upgrades.starSmuggler > 0) {
                if (Math.random() < SMUGGLER_LOOT_CHANCE) {
                    const lootAmount = Math.floor(Math.random() * (SMUGGLER_LOOT_MAX - SMUGGLER_LOOT_MIN + 1)) + SMUGGLER_LOOT_MIN;
                    // Informa o cliente para criar o container visual
                    io.to(socket.id).emit('spawnLootContainer', { x, y, amount: lootAmount });
                    // O dinheiro será dado quando o cliente pegar o loot
                }
            }
            
            player.dinheiro += gain; 
            socket.emit('gainMoney', gain);
            if (converted) {
                 socket.emit('showFloatingText', { text: message, color: color });
            }
        }
    });
    
    // NOVO: Cliente pegou o loot
    socket.on('lootCollected', (data) => {
         const { roomId, amount } = data;
         const player = gameRooms[roomId]?.players[socket.id];
         if (player) {
             player.dinheiro += amount;
             socket.emit('gainMoney', amount);
             socket.emit('showFloatingText', { text: `+ $${amount} (Loot)`, color: '#FFFF00' });
         }
    });

    
    socket.on('neutralAsteroidCreated', (data) => {
        const { roomId, asteroidId, x, y } = data;
        const room = gameRooms[roomId];
        if (room) {
            room.neutralAsteroids[asteroidId] = { id: asteroidId, x: x, y: y };
        }
    });
    
    socket.on('activateMatterConverter', (roomId) => {
         const room = gameRooms[roomId];
         const player = room?.players[socket.id];
         
         if (player && player.upgrades.matterConverter > 0 && player.converterCooldown <= 0) {
             player.converterCooldown = MATTER_CONVERTER_COOLDOWN;
             let convertedCount = 0;
             let totalGain = 0;
             let absorbedIds = Object.keys(room.neutralAsteroids);
             
             io.to(socket.id).emit('absorbNeutrals', absorbedIds);
             
             for (const id in room.neutralAsteroids) {
                 convertedCount++;
                 totalGain += 25;
                 delete room.neutralAsteroids[id];
             }
             
             if (totalGain > 0) {
                 player.dinheiro += totalGain;
                 socket.emit('gainMoney', totalGain);
                 socket.emit('showFloatingText', {
                    text: `+ $${totalGain} (${convertedCount} Convertidos)`, color: '#00FF00', size: '1.5em'
                 });
             }
             io.to(roomId).emit('updateGameState', room.players);
         }
    });
    
    socket.on('activateShieldOverload', (roomId) => {
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
        if (player && player.upgrades.ultimate_shield > 0 && player.shieldOverloadCooldown <= 0) {
            player.shieldOverloadCooldown = SHIELD_OVERLOAD_COOLDOWN;
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // NOVO: Jogador ativou Salto Hiper-Espacial
    socket.on('activateHyperspaceJump', (data) => {
        const { roomId, targetX, targetY } = data;
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        
         if (player && player.upgrades.hyperspaceJump > 0 && player.hyperspaceCooldown <= 0) {
             player.hyperspaceCooldown = HYPERSPACE_JUMP_COOLDOWN; // Ativa cooldown
             // Informa o cliente (e o oponente) sobre o salto para efeitos visuais
             io.to(roomId).emit('playerJumped', { playerId: socket.id, x: targetX, y: targetY });
             // Atualiza estado (cooldown)
             io.to(roomId).emit('updateGameState', room.players);
         }
    });


    // 6. Enviar Inimigo Normal
    socket.on('sendNormalEnemy', (roomId) => {
        const CUSTO = 50; /* ... */ 
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            const enemyData = { type: 'normal', count: 1 + player.upgrades.enviarMais, health: 10 + (player.upgrades.asteroidVida * 5), size: 1 + player.upgrades.asteroidMaior, shoots: false, bountyValue: 10 };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });

    // 7. Enviar Inimigo Atirador
    socket.on('sendShooterEnemy', (roomId) => {
        const CUSTO = 250; /* ... */
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.dinheiro < CUSTO) return;
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            const enemyData = { type: 'shooter', count: 1, health: 50 + (player.upgrades.asteroidVida * 10), size: 1 + player.upgrades.asteroidMaior, shoots: true, shooterLevel: player.upgrades.asteroidVida, bountyValue: 50 };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // 8. Enviar Asteroide-Bomba
    socket.on('sendBomberEnemy', (roomId) => {
        const CUSTO = 400; /* ... */
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.upgrades.bomberAsteroid < 1 || player.dinheiro < CUSTO) return;
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            const enemyData = { type: 'bomber', count: 1, health: 100 + (player.upgrades.asteroidVida * 10), size: 1 + player.upgrades.asteroidMaior, shoots: false, bountyValue: 75 };
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // 9. Enviar Inibidor de Renda
    socket.on('sendIncomeInhibitor', (roomId) => {
        const CUSTO = 350; /* ... */
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];
        if (!player || player.upgrades.incomeInhibitor < 1 || player.dinheiro < CUSTO) return;
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            const inhibitorId = `inhibitor_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const enemyData = { type: 'inhibitor', id: inhibitorId, count: 1, health: 50, size: 1, shoots: false, bountyValue: 20 };
            // Usa ?. para segurança caso room ou inhibitorTimers não existam ainda
            room?.inhibitorTimers?.[opponentId]?.[inhibitorId] = 15;
            io.to(opponentId).emit('receiveEnemy', enemyData);
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // 10. NOVO: Enviar Campo Minado
    socket.on('sendMinefield', (roomId) => {
        const CUSTO = 200;
        const MAX_MINES = 6;
        const MINE_DURATION = 20; // Segundos
        const room = gameRooms[roomId];
        const player = room?.players[socket.id];

        if (!player || player.upgrades.minefieldDeploy < 1 || player.dinheiro < CUSTO) return;
        // Verifica limite de minas
        if (player.mineCount >= MAX_MINES) return;

        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            player.dinheiro -= CUSTO;
            
            const minesData = [];
            const minesToSend = 3; // Envia 3 minas
            
            for(let i = 0; i < minesToSend && player.mineCount < MAX_MINES; i++) {
                 const mineId = `mine_${socket.id}_${Date.now()}_${i}`;
                 minesData.push({
                    type: 'mine', // NOVO TIPO
                    id: mineId,
                    ownerId: socket.id, // Para saber quem plantou
                    health: 1, // Morre com 1 tiro
                    damage: 50, // Dano da explosão
                    radius: 40, // Raio da explosão
                    bountyValue: 5 // Recompensa mínima
                 });
                 // Adiciona ao estado do servidor (associado a quem enviou)
                 room.mines[socket.id][mineId] = { timer: MINE_DURATION };
                 player.mineCount++;
            }
            
            // Envia dados das minas para o oponente
            io.to(opponentId).emit('receiveMines', minesData);
            // Atualiza estado (dinheiro, contagem de minas)
            io.to(roomId).emit('updateGameState', room.players);
        }
    });
    
    // NOVO: Cliente informa que uma mina explodiu ou expirou
    socket.on('mineExpiredOrDetonated', (data) => {
        const { roomId, mineId, ownerId } = data;
        const room = gameRooms[roomId];
        const ownerPlayer = room?.players[ownerId];
        
        // Remove do estado do servidor
        if (room?.mines?.[ownerId]?.[mineId]) {
             delete room.mines[ownerId][mineId];
             if (ownerPlayer) {
                 ownerPlayer.mineCount = Math.max(0, ownerPlayer.mineCount - 1);
                 // Atualiza contagem para o dono da mina
                 io.to(ownerId).emit('updateMineCount', ownerPlayer.mineCount);
             }
        }
    });

    
    socket.on('inhibitorDestroyed', (data) => {
        const { roomId, inhibitorId } = data;
        const room = gameRooms[roomId];
        const myTimers = room?.inhibitorTimers[socket.id];
        if (myTimers && myTimers[inhibitorId] !== undefined) {
            delete myTimers[inhibitorId]; 
        }
    });

    socket.on('sendSnapshot', (data) => {
        const { roomId, snapshot } = data;
        const room = gameRooms[roomId];
        if (!room) return;
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('receiveSnapshot', snapshot);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                // Limpa minas e inibidores associados a este jogador
                if(room.mines) delete room.mines[socket.id];
                if(room.inhibitorTimers) delete room.inhibitorTimers[socket.id];
                
                delete room.players[socket.id];
                if (opponentId) {
                    io.to(opponentId).emit('opponentLeft');
                }
                // Se a sala ficar vazia, remove-a
                if (Object.keys(room.players).length === 0) {
                     delete gameRooms[roomId];
                     console.log(`Sala ${roomId} limpa.`);
                }
                break;
            }
        }
    });
});

// Loop de Renda (ATUALIZADO para Minas)
function startIncomeLoop(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;

    const intervalId = setInterval(() => {
        const currentRoom = gameRooms[roomId]; 
        if (!currentRoom || !currentRoom.gameRunning) {
            clearInterval(intervalId); return;
        }

        let stateChanged = false;
        for (const playerId in currentRoom.players) {
            const player = currentRoom.players[playerId];
            if (!player) continue;

            // Cooldowns Habilidades
            if (player.converterCooldown > 0) { player.converterCooldown--; stateChanged = true; }
            if (player.shieldOverloadCooldown > 0) { player.shieldOverloadCooldown--; stateChanged = true; }
            if (player.hyperspaceCooldown > 0) { player.hyperspaceCooldown--; stateChanged = true; } // NOVO
            
            // Debuff Renda
            let incomeMultiplier = 1.0;
            if (player.incomeDebuffDuration > 0) { player.incomeDebuffDuration--; incomeMultiplier = INCOME_DEBUFF_MULTIPLIER; stateChanged = true; }
            
            // Renda Normal
            player.dinheiro += Math.floor(player.upgrades.income * incomeMultiplier);
            stateChanged = true;
            
            // Banco Galáctico
            if (player.upgrades.galacticBank > 0) {
                player.bankTimer--;
                if (player.bankTimer <= 0) {
                    player.bankTimer = 10; const bankLevel = player.upgrades.galacticBank;
                    const taxaJuros = 0.01 + (bankLevel * 0.005); const tetoJuros = 20 + (bankLevel * 10);     
                    let juros = Math.floor(player.dinheiro * taxaJuros); if (juros > tetoJuros) juros = tetoJuros;
                    if (juros > 0) { player.dinheiro += juros; io.to(playerId).emit('showFloatingText', { text: `+ $${juros} (Juros)`, color: '#FFD700' }); }
                }
                 stateChanged = true;
            }
            
            // Timers Inibidores
            const inhibitorTimers = currentRoom.inhibitorTimers?.[playerId] || {};
            for (const inhibitorId in inhibitorTimers) {
                 inhibitorTimers[inhibitorId]--;
                 if (inhibitorTimers[inhibitorId] <= 0) {
                     player.incomeDebuffDuration = INCOME_DEBUFF_DURATION; delete inhibitorTimers[inhibitorId]; 
                     io.to(playerId).emit('showFloatingText', { text: `RENDA REDUZIDA! (-50% por ${INCOME_DEBUFF_DURATION}s)`, color: '#FF0000', size: '1.3em' });
                     stateChanged = true;
                 }
            }
            
            // NOVO: Timers das Minas (enviadas PELO jogador)
            const myMines = currentRoom.mines?.[playerId] || {};
            let minesExpired = [];
            for (const mineId in myMines) {
                myMines[mineId].timer--;
                if (myMines[mineId].timer <= 0) {
                    minesExpired.push(mineId); // Marca para remover
                    player.mineCount = Math.max(0, player.mineCount - 1);
                    stateChanged = true;
                }
            }
            // Remove minas expiradas e informa oponentes
            if (minesExpired.length > 0) {
                 for (const mineId of minesExpired) {
                     delete myMines[mineId];
                 }
                 // Envia lista de IDs expirados para todos na sala
                 io.to(roomId).emit('minesExpired', minesExpired);
            }
            
        } // Fim loop jogadores

        if (stateChanged) {
            io.to(roomId).emit('updateGameState', currentRoom.players);
        }
    }, 1000); 
}

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});