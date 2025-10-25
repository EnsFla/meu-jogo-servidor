// server.js - O CÉREBRO DO SEU JOGO MULTIPLAYER (v5.8 - MAIS 10 Upgrades!)
const SERVER_URL = 'https://meu-jogo-pvp.onrender.com';
const socket = io(SERVER_URL); // <-- ATUALIZE AQUI
let meuSocketId = null;
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

function keepAlive() {
    fetch(SERVER_URL + '/keep-alive')
        .then(res => res.json())
        .then(data => console.log('Keep-alive ping:', data.status))
        .catch(err => console.warn('Keep-alive ping falhou:', err));
}

setInterval(keepAlive, 300000);

const PORT = process.env.PORT || 3000;

// ----- Lógica Central do Jogo -----

const UPGRADE_DEFINITIONS = {
    // === Armas ===
    missil:         { maxLevel: 3, baseCost: 200 },
    tiroDuplo:      { maxLevel: 1, baseCost: 150 },
    laser:          { maxLevel: 5, baseCost: 300 },
    homingMissile:  { maxLevel: 1, baseCost: 1000 },
    piercingShots:  { maxLevel: 1, baseCost: 750 },
    cryoAmmo:       { maxLevel: 1, baseCost: 1200 },
    enhancedCharge: { maxLevel: 1, baseCost: 900 },  // Homing Explode
    napalmFragments:{ maxLevel: 1, baseCost: 1100 }, // Missil AoE Fire
    superchargeCore:{ maxLevel: 3, baseCost: 600 },  // Proj Speed/Dmg
    unstableMunitions:{ maxLevel: 1, baseCost: 850 }, // Proj Chance Explode
    targetingComputer:{ maxLevel: 3, baseCost: 500 }, // Homing/Spread
    chainReaction:  { maxLevel: 1, baseCost: 1500 }, // Destroy Explode
    batteryCannons: { maxLevel: 1, baseCost: 700, dependency: 'escudo' }, // Shield Attack (E)
    ricochetMissiles:{ maxLevel: 1, baseCost: 1300, dependency: 'missil' }, // Missil AoE Ricochet
    laserAmplifier: { maxLevel: 3, baseCost: 400, dependency: 'laser' },   // Laser Range/Width
    deepFreeze:     { maxLevel: 1, baseCost: 800, dependency: 'cryoAmmo' }, // Crio Buff
    orbitalMarker:  { maxLevel: 1, baseCost: 1800 }, // Habilidade (T)
    // === Nave ===
    velocidade:     { maxLevel: 3, baseCost: 50 },
    resistencia:    { maxLevel: 3, baseCost: 250 },
    escudo:         { maxLevel: 5, baseCost: 100 },
    matterConverter:{ maxLevel: 1, baseCost: 600 },  // Habilidade (R)
    hyperspaceJump: { maxLevel: 1, baseCost: 800 },  // Habilidade (BTN Dir)
    repulsorField:  { maxLevel: 1, baseCost: 450 },  // Empurra Pequenos
    stasisField:    { maxLevel: 1, baseCost: 700 },  // Habilidade (C)
    energyReconfig: { maxLevel: 1, baseCost: 1000 }, // Habilidade (X)
    kineticAccelerator:{ maxLevel: 1, baseCost: 950, dependency: 'velocidade' }, // Ram Damage
    cargoCollector: { maxLevel: 1, baseCost: 300, dependency: 'starSmuggler' }, // Loot Magnet
    // === Ataque (Envio / Modificadores) ===
    enviarMais:     { maxLevel: 10, baseCost: 75 }, // Ast Normal Count
    asteroidVida:   { maxLevel: 10, baseCost: 100 }, // All Sent Health
    asteroidMaior:  { maxLevel: 5, baseCost: 150 },  // All Sent Size
    sendCooldown:   { maxLevel: 5, baseCost: 200 },  // All Sent Cooldown
    bomberAsteroid: { maxLevel: 1, baseCost: 400 },  // Unlock Bomber
    incomeInhibitor:{ maxLevel: 1, baseCost: 350 },  // Unlock Inhibitor
    minefieldDeploy:{ maxLevel: 1, baseCost: 200 },  // Unlock Mines
    advancedTargeting:{ maxLevel: 1, baseCost: 550 }, // Shooter Buff
    hunterAsteroid: { maxLevel: 1, baseCost: 650 },  // Unlock Hunter
    impactShrapnel: { maxLevel: 1, baseCost: 500 },  // Normal Destroy Burst
    ricochetShots:  { maxLevel: 1, baseCost: 1400, dependency: 'advancedTargeting'}, // Shooter Ricochet
    volatileCore:   { maxLevel: 3, baseCost: 450 },  // Normal/Shooter Destroy AoE
    shieldDisruptor:{ maxLevel: 1, baseCost: 600 },  // Unlock Disruptor
    reinforcedHull: { maxLevel: 1, baseCost: 1600 }, // Sent Armor
    toxicShards:    { maxLevel: 1, baseCost: 750, dependency: 'bomberAsteroid' }, // Bomber Debuff
    spectralShip:   { maxLevel: 1, baseCost: 500 },  // Unlock Spectral
    // === Renda ===
    income:         { maxLevel: 99, baseCost: 10 },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100] },
    galacticBank:   { maxLevel: 5, baseCost: 300 }, // Juros
    starSmuggler:   { maxLevel: 1, baseCost: 500 }, // Loot Drop
    merchantCall:   { maxLevel: 1, baseCost: 900 }, // Habilidade (B)
    combatRecycler: { maxLevel: 3, baseCost: 400 }, // Proj Destroy Income
    rewardHack:     { maxLevel: 1, baseCost: 800 }, // Habilidade (V)
    attritionTax:   { maxLevel: 3, baseCost: 350 }, // Enemy Send Income
    // === Exclusivos ===
    masterOfArms:   { maxLevel: 1, baseCost: 5000 }, // Permite 2º Exclusivo
    // Armas
    ultimate_cluster: { maxLevel: 1, baseCost: 2500, dependency: 'tiroDuplo' },
    ultimate_laser:   { maxLevel: 1, baseCost: 2500, dependency: 'laser' },
    ultimate_prism:   { maxLevel: 1, baseCost: 1500, dependency: 'ultimate_laser' }, // Adicional
    ultimate_barrage: { maxLevel: 1, baseCost: 2500, dependency: 'missil' },
    ultimate_swarm:   { maxLevel: 1, baseCost: 2500, dependency: 'homingMissile' },
    ultimate_singularity: { maxLevel: 1, baseCost: 3000, dependency: 'homingMissile' }, // Alternativo ao Swarm
    // Nave / Defesa
    ultimate_shield:  { maxLevel: 1, baseCost: 2000, dependency: 'escudo' },
    // Ataque
    ultimate_stealthMines: { maxLevel: 1, baseCost: 1800, dependency: 'minefieldDeploy' }, // Adicional
    ultimate_barrageCoord: { maxLevel: 1, baseCost: 2000, dependency: 'advancedTargeting' }, // Shooter
    // Renda
    ultimate_blackMarket:  { maxLevel: 1, baseCost: 2200, dependency: 'starSmuggler' },      // Adicional
    ultimate_riskyInvest:  { maxLevel: 1, baseCost: 1800, dependency: 'galacticBank' },    // Banco
    ultimate_effConversion:{ maxLevel: 1, baseCost: 1500, dependency: 'combatRecycler' }    // Reciclador
};

// Constantes de Cooldown e Efeitos
const MATTER_CONVERTER_COOLDOWN = 20;
const SHIELD_OVERLOAD_COOLDOWN = 15;
const HYPERSPACE_JUMP_COOLDOWN = 10;
const STASIS_FIELD_COOLDOWN = 25;
const MERCHANT_CALL_COOLDOWN = 60;
const ENERGY_RECONFIG_COOLDOWN = 45;
const REWARD_HACK_COOLDOWN = 30;
const ORBITAL_MARKER_COOLDOWN = 45;
const INCOME_DEBUFF_DURATION = 10;
const INCOME_DEBUFF_MULTIPLIER = 0.5;
const SMUGGLER_LOOT_CHANCE = 0.1; const SMUGGLER_LOOT_MIN = 50; const SMUGGLER_LOOT_MAX = 100;
const BLACKMARKET_CHANCE = 0.25; const BLACKMARKET_POWERUP_CHANCE = 0.1;
const RECYCLER_MONEY_PER_LEVEL = [0, 1, 2, 3];
const ATTRITION_TAX_PER_LEVEL = [0, 1, 2, 3];
const RISKY_INVEST_TIMER = 30;
const RISKY_INVEST_CHANCES = { success: 0.6, fail: 0.1, nothing: 0.3 };
const RISKY_INVEST_BONUS = 500;
const RISKY_INVEST_LOSS_PERCENT = 0.2;
const RISKY_INVEST_LOSS_CAP = 200;

function createPlayerState() {
    return {
        id: null, vidas: 3, dinheiro: 100000, 
        hasUltimate: false, canHaveSecondUltimate: false, ultimateCount: 0,
        bankTimer: 10, riskyInvestTimer: RISKY_INVEST_TIMER,
        // Cooldowns
        converterCooldown: 0, shieldOverloadCooldown: 0, hyperspaceCooldown: 0,
        stasisFieldCooldown: 0, merchantCallCooldown: 0, energyReconfigCooldown: 0,
        rewardHackCooldown: 0, orbitalMarkerCooldown: 0,
        // Debuffs / Estado
        incomeDebuffDuration: 0, mineCount: 0, merchantActive: false, 
        energyReconfigActive: false,
        upgrades: {
            // Armas
            missil: 0, tiroDuplo: 0, laser: 0, homingMissile: 0, piercingShots: 0, cryoAmmo: 0, enhancedCharge: 0, napalmFragments: 0, superchargeCore: 0, unstableMunitions: 0, targetingComputer: 0, chainReaction: 0, batteryCannons: 0, ricochetMissiles: 0, laserAmplifier: 0, deepFreeze: 0, orbitalMarker: 0,
            // Nave
            velocidade: 0, resistencia: 0, escudo: 0, matterConverter: 0, hyperspaceJump: 0, repulsorField: 0, stasisField: 0, energyReconfig: 0, kineticAccelerator: 0, cargoCollector: 0,
            // Ataque
            enviarMais: 0, asteroidVida: 0, asteroidMaior: 0, sendCooldown: 0, bomberAsteroid: 0, incomeInhibitor: 0, minefieldDeploy: 0, advancedTargeting: 0, hunterAsteroid: 0, impactShrapnel: 0, ricochetShots: 0, volatileCore: 0, shieldDisruptor: 0, reinforcedHull: 0, toxicShards: 0, spectralShip: 0,
            // Renda
            income: 1, bounty: 0, galacticBank: 0, starSmuggler: 0, merchantCall: 0, combatRecycler: 0, rewardHack: 0, attritionTax: 0,
            // Geral / Exclusivos
            masterOfArms: 0,
            ultimate_cluster: 0, ultimate_laser: 0, ultimate_prism: 0, ultimate_barrage: 0, ultimate_swarm: 0, ultimate_singularity: 0, ultimate_shield: 0, ultimate_stealthMines: 0, ultimate_barrageCoord: 0, ultimate_blackMarket: 0, ultimate_riskyInvest: 0, ultimate_effConversion: 0
        }
    };
}

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) return def.baseCost[currentLevel] || Infinity;
    // Custos Especiais
    if (['galacticBank', 'combatRecycler', 'volatileCore', 'attritionTax', 'targetingComputer', 'laserAmplifier', 'superchargeCore'].includes(upgradeKey)) {
        return Math.floor(def.baseCost * Math.pow(1.5, currentLevel)); // Custo exponencial maior
    }
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel)); // Custo padrão
}

const gameRooms = {};

io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // 1. Entrar na Sala
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} entrou na sala ${roomId}`);
        if (!gameRooms[roomId]) {
            gameRooms[roomId] = { players: {}, neutralAsteroids: {}, inhibitorTimers: {}, mines: {} };
        }
        const room = gameRooms[roomId];
        if (Object.keys(room.players).length < 2) {
            const newPlayer = createPlayerState(); newPlayer.id = socket.id; room.players[socket.id] = newPlayer;
            room.inhibitorTimers[socket.id] = {}; room.mines[socket.id] = {};
            if (Object.keys(room.players).length === 2) {
                console.log(`Sala ${roomId} está cheia. Começando o jogo.`); room.gameRunning = true;
                const otherPlayerId = Object.keys(room.players).find(id => id !== socket.id);
                if (otherPlayerId && !room.inhibitorTimers[otherPlayerId]) room.inhibitorTimers[otherPlayerId] = {};
                if (otherPlayerId && !room.mines[otherPlayerId]) room.mines[otherPlayerId] = {};
                io.to(roomId).emit('gameStart', room); startIncomeLoop(roomId);
            }
        } else { socket.emit('roomFull'); }
        io.to(roomId).emit('updateGameState', room.players);
    });

    // 2. Comprar Upgrade
    socket.on('buyUpgrade', (data) => {
        const { roomId, upgradeKey } = data; const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (!player || !UPGRADE_DEFINITIONS[upgradeKey]) return;
        const def = UPGRADE_DEFINITIONS[upgradeKey]; const currentLevel = player.upgrades[upgradeKey];
        if (currentLevel >= def.maxLevel) return; const cost = getUpgradeCost(upgradeKey, currentLevel); if (player.dinheiro < cost) return;
        
        if (upgradeKey === 'masterOfArms') {
            if (!player.hasUltimate) return; // Precisa ter comprado o primeiro ultimate
            player.dinheiro -= cost; player.upgrades[upgradeKey]++; player.canHaveSecondUltimate = true;
        }
        else if (upgradeKey.startsWith('ultimate_')) {
            const isAdditionalUltimate = ['ultimate_prism', 'ultimate_stealthMines', 'ultimate_blackMarket', 'ultimate_effConversion', 'ultimate_riskyInvest', 'ultimate_barrageCoord'].includes(upgradeKey);
            
            if (!isAdditionalUltimate && ((player.hasUltimate && !player.canHaveSecondUltimate) || player.ultimateCount >= (player.canHaveSecondUltimate ? 2 : 1) )) {
                 const isAlternative = (upgradeKey === 'ultimate_swarm' && player.upgrades.ultimate_singularity > 0) || (upgradeKey === 'ultimate_singularity' && player.upgrades.ultimate_swarm > 0);
                 if(!isAlternative) return;
            }

            const dependencyKey = def.dependency; const dependencyDef = UPGRADE_DEFINITIONS[dependencyKey];
            const dependencyLevel = player.upgrades[dependencyKey];
            const requiredLevel = isAdditionalUltimate ? 1 : dependencyDef.maxLevel;
            if (dependencyLevel < requiredLevel) return; 
            
            player.dinheiro -= cost; player.upgrades[upgradeKey]++;
            
            if (!isAdditionalUltimate) {
                 const isReplacingAlternative = (upgradeKey === 'ultimate_swarm' && player.upgrades.ultimate_singularity > 0) || (upgradeKey === 'ultimate_singularity' && player.upgrades.ultimate_swarm > 0);
                 if (!isReplacingAlternative) { 
                    if (!player.hasUltimate) player.hasUltimate = true; 
                    player.ultimateCount++; 
                 } else {
                     if (upgradeKey === 'ultimate_swarm') player.upgrades.ultimate_singularity = 0;
                     if (upgradeKey === 'ultimate_singularity') player.upgrades.ultimate_swarm = 0;
                 }
            }
            
        } 
        else { // Upgrade Normal
            player.dinheiro -= cost; player.upgrades[upgradeKey]++;
            if (upgradeKey === 'resistencia') player.vidas++;
        }
        io.to(roomId).emit('updateGameState', room.players);
    });

    // 3. Jogador foi Atingido
    socket.on('playerHit', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (player && room?.gameRunning) {
            player.vidas--;
            if (player.vidas <= 0) { const opponentId = Object.keys(room.players).find(id => id !== socket.id); io.to(roomId).emit('gameOver', { winner: opponentId, loser: socket.id }); room.gameRunning = false; delete gameRooms[roomId]; } 
            else { io.to(roomId).emit('updateGameState', room.players); }
        }
    });

    // 4. Asteroide Destruído (Bounty)
    socket.on('asteroidDestroyed', (data) => {
        const { roomId, bountyValue, hackerId } = data; // Recebe quem hackeou (se houver)
        const room = gameRooms[roomId]; 
        const destroyerPlayer = room?.players[socket.id]; // Quem destruiu
        const hackerPlayer = hackerId ? room?.players[hackerId] : null; // Quem hackeou
        
        let targetPlayer = destroyerPlayer; // Por padrão, quem destruiu recebe
        if (hackerPlayer) {
             targetPlayer = hackerPlayer; // Se foi hackeado, quem hackeou recebe
        }

        if (targetPlayer && bountyValue > 0) {
            const bountyMultiplier = 1.0 + (targetPlayer.upgrades.bounty * 0.1); 
            const totalBounty = Math.floor(bountyValue * bountyMultiplier); 
            targetPlayer.dinheiro += totalBounty; 
            // Informa o jogador que recebeu o dinheiro
            io.to(targetPlayer.id).emit('gainMoney', totalBounty);
            if (hackerPlayer) {
                 io.to(targetPlayer.id).emit('showFloatingText', { text: `+ $${totalBounty} (Hack)`, color: '#AA00FF' });
            }
        }
    });
    
    // 5. Asteroide Neutro Destruído / Convertido (Smuggler / Black Market)
    socket.on('neutralAsteroidDestroyed', (data) => {
        const { roomId, asteroidId, converted, x, y } = data; const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (room && room.neutralAsteroids[asteroidId]) delete room.neutralAsteroids[asteroidId];
        if (player) {
            let gain = 25; let message = converted ? `+ $${gain} (Convertido)` : `+ $${gain}`; let color = converted ? '#00FF00' : 'white';
            
            if (!converted && player.upgrades.starSmuggler > 0) {
                const isBlackMarket = player.upgrades.ultimate_blackMarket > 0;
                const chance = isBlackMarket ? BLACKMARKET_CHANCE : SMUGGLER_LOOT_CHANCE;
                if (Math.random() < chance) {
                    if (isBlackMarket && Math.random() < BLACKMARKET_POWERUP_CHANCE) {
                         const powerups = ['rapidFire', 'instantShield', 'tempLife'];
                         const chosenPowerup = powerups[Math.floor(Math.random() * powerups.length)];
                         io.to(socket.id).emit('spawnLootContainer', { x, y, type: 'powerup', powerupType: chosenPowerup });
                    } else {
                        const lootAmount = Math.floor(Math.random() * (SMUGGLER_LOOT_MAX - SMUGGLER_LOOT_MIN + 1)) + SMUGGLER_LOOT_MIN;
                        io.to(socket.id).emit('spawnLootContainer', { x, y, type: 'money', amount: lootAmount });
                    }
                }
            }
            
            player.dinheiro += gain; socket.emit('gainMoney', gain);
            if (converted) socket.emit('showFloatingText', { text: message, color: color });
        }
    });
    
    // Loot coletado (Dinheiro)
    socket.on('lootCollected', (data) => {
         const { roomId, amount } = data; const player = gameRooms[roomId]?.players[socket.id];
         if (player) { player.dinheiro += amount; socket.emit('gainMoney', amount); socket.emit('showFloatingText', { text: `+ $${amount} (Loot)`, color: '#FFFF00' }); }
    });
    // Powerup Coletado
    socket.on('powerupCollected', (data) => {
         const { roomId, powerupType } = data;
         const player = gameRooms[roomId]?.players[socket.id];
         if (player) { io.to(socket.id).emit('activatePowerup', powerupType); socket.emit('showFloatingText', { text: `Power-up: ${powerupType}!`, color: '#FF00FF' }); }
    });

    // Asteroide neutro criado
    socket.on('neutralAsteroidCreated', (data) => { const { roomId, asteroidId, x, y } = data; const room = gameRooms[roomId]; if (room) room.neutralAsteroids[asteroidId] = { id: asteroidId, x: x, y: y }; });
    
    // --- Habilidades ---
    socket.on('activateMatterConverter', (roomId) => {
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
         if (player && player.upgrades.matterConverter > 0 && player.converterCooldown <= 0) {
             player.converterCooldown = MATTER_CONVERTER_COOLDOWN; let convertedCount = 0; let totalGain = 0; let absorbedIds = Object.keys(room.neutralAsteroids);
             io.to(socket.id).emit('absorbNeutrals', absorbedIds);
             for (const id in room.neutralAsteroids) { convertedCount++; totalGain += 25; delete room.neutralAsteroids[id]; }
             if (totalGain > 0) { player.dinheiro += totalGain; socket.emit('gainMoney', totalGain); socket.emit('showFloatingText', { text: `+ $${totalGain} (${convertedCount} Convertidos)`, color: '#00FF00', size: '1.5em' }); }
             io.to(roomId).emit('updateGameState', room.players);
         }
    });
    socket.on('activateShieldOverload', (roomId) => {
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (player && player.upgrades.ultimate_shield > 0 && player.shieldOverloadCooldown <= 0) { player.shieldOverloadCooldown = SHIELD_OVERLOAD_COOLDOWN; io.to(roomId).emit('updateGameState', room.players); }
    });
    socket.on('activateHyperspaceJump', (data) => {
        const { roomId, targetX, targetY } = data; const room = gameRooms[roomId]; const player = room?.players[socket.id];
         if (player && player.upgrades.hyperspaceJump > 0 && player.hyperspaceCooldown <= 0) { player.hyperspaceCooldown = HYPERSPACE_JUMP_COOLDOWN; io.to(roomId).emit('playerJumped', { playerId: socket.id, x: targetX, y: targetY }); io.to(roomId).emit('updateGameState', room.players); }
    });
    socket.on('activateStasisField', (roomId) => {
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
         if (player && player.upgrades.stasisField > 0 && player.stasisFieldCooldown <= 0) {
             player.stasisFieldCooldown = STASIS_FIELD_COOLDOWN;
             io.to(roomId).emit('stasisFieldActivated', { playerId: socket.id });
             io.to(roomId).emit('updateGameState', room.players);
         }
    });
    socket.on('activateMerchantCall', (roomId) => {
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
         if (player && player.upgrades.merchantCall > 0 && player.merchantCallCooldown <= 0 && !player.merchantActive) {
             player.merchantCallCooldown = MERCHANT_CALL_COOLDOWN;
             player.merchantActive = true;
             io.to(socket.id).emit('spawnMerchant');
             setTimeout(() => {
                 const currentPlayer = gameRooms[roomId]?.players[socket.id]; 
                 if (currentPlayer) currentPlayer.merchantActive = false;
                 io.to(socket.id).emit('removeMerchant');
             }, 10000); // 10 segundos
             io.to(roomId).emit('updateGameState', room.players);
         }
    });
    socket.on('buyMerchantItem', (data) => {
        const { roomId, itemKey, cost } = data;
        const player = gameRooms[roomId]?.players[socket.id];
        if (player && player.merchantActive && player.dinheiro >= cost) {
            player.dinheiro -= cost;
            if (itemKey === 'bonusMoney') {
                player.dinheiro += 150; socket.emit('gainMoney', 150);
                socket.emit('showFloatingText', { text: `+ $150 (Mercador)`, color: '#FFFF00' });
            } 
            else if (itemKey === 'instantShield') { io.to(socket.id).emit('activatePowerup', 'instantShield'); }
            else if (itemKey === 'rapidFireBoost') { io.to(socket.id).emit('activatePowerup', 'rapidFire'); }
             player.merchantActive = false;
             io.to(socket.id).emit('removeMerchant');
             io.to(roomId).emit('updateGameState', gameRooms[roomId].players);
        }
    });
    socket.on('activateEnergyReconfig', (roomId) => {
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
         if (player && player.upgrades.energyReconfig > 0 && player.energyReconfigCooldown <= 0) {
             player.energyReconfigCooldown = ENERGY_RECONFIG_COOLDOWN;
             player.energyReconfigActive = true; 
             io.to(roomId).emit('playerReconfigured', { playerId: socket.id, active: true }); 
             setTimeout(() => {
                  const currentPlayer = gameRooms[roomId]?.players[socket.id];
                  if(currentPlayer) currentPlayer.energyReconfigActive = false;
                  io.to(roomId).emit('playerReconfigured', { playerId: socket.id, active: false });
             }, 5000); // 5 segundos
             io.to(roomId).emit('updateGameState', room.players);
         }
    });
    socket.on('activateRewardHack', (data) => {
        const { roomId, targetId } = data; 
        const room = gameRooms[roomId]; const player = room?.players[socket.id];
        if (player && player.upgrades.rewardHack > 0 && player.rewardHackCooldown <= 0) {
            player.rewardHackCooldown = REWARD_HACK_COOLDOWN;
            const opponentId = Object.keys(room.players).find(id => id !== socket.id);
            if (opponentId) {
                // Informa o oponente (dono do asteroide) quem hackeou
                 io.to(opponentId).emit('asteroidHacked', { asteroidId: targetId, hackerId: socket.id });
            }
             io.to(roomId).emit('updateGameState', room.players); // Atualiza cooldown
        }
    });
    socket.on('activateOrbitalMarker', (data) => {
         const { roomId, targetX, targetY } = data; 
         const room = gameRooms[roomId]; const player = room?.players[socket.id];
          if (player && player.upgrades.orbitalMarker > 0 && player.orbitalMarkerCooldown <= 0) {
              player.orbitalMarkerCooldown = ORBITAL_MARKER_COOLDOWN;
              io.to(roomId).emit('orbitalMarkerPlaced', { x: targetX, y: targetY });
              // O dano/efeito é tratado no cliente após um delay visual
              io.to(roomId).emit('updateGameState', room.players);
          }
    });
    
    // Reciclador de Combate
    socket.on('enemyProjectileDestroyed', (roomId) => {
        const player = gameRooms[roomId]?.players[socket.id];
        if (player && player.upgrades.combatRecycler > 0) {
            const gain = RECYCLER_MONEY_PER_LEVEL[player.upgrades.combatRecycler];
            if (gain > 0) { player.dinheiro += gain; socket.emit('gainMoney', gain); }
        }
    });


    // --- Envio de Unidades ---
    socket.on('sendNormalEnemy', (roomId) => { const CUSTO = 50; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'normal', count: 1 + player.upgrades.enviarMais, health: 10 + (player.upgrades.asteroidVida * 5), size: 1 + player.upgrades.asteroidMaior, shoots: false, bountyValue: 10 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('sendShooterEnemy', (roomId) => { const CUSTO = 250; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'shooter', count: 1, health: 50 + (player.upgrades.asteroidVida * 10), size: 1 + player.upgrades.asteroidMaior, shoots: true, shooterLevel: player.upgrades.asteroidVida, bountyValue: 50, advancedTargeting: player.upgrades.advancedTargeting > 0 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('sendBomberEnemy', (roomId) => { const CUSTO = 400; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.bomberAsteroid < 1 || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'bomber', count: 1, health: 100 + (player.upgrades.asteroidVida * 10), size: 1 + player.upgrades.asteroidMaior, shoots: false, bountyValue: 75, toxicShards: player.upgrades.toxicShards > 0 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } }); // Passa toxicShards
    socket.on('sendIncomeInhibitor', (roomId) => { const CUSTO = 350; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.incomeInhibitor < 1 || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const inhibitorId = `inhibitor_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`; const enemyData = { type: 'inhibitor', id: inhibitorId, count: 1, health: 50, size: 1, shoots: false, bountyValue: 20 }; if (room && room.inhibitorTimers && room.inhibitorTimers[opponentId]) { room.inhibitorTimers[opponentId][inhibitorId] = 15; } else { console.error("Erro: inhibitorTimers não inicializado para oponente:", opponentId); if(room && !room.inhibitorTimers) room.inhibitorTimers = {}; if(room && !room.inhibitorTimers[opponentId]) room.inhibitorTimers[opponentId] = {}; if(room?.inhibitorTimers?.[opponentId]) room.inhibitorTimers[opponentId][inhibitorId] = 15; } io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('inhibitorDestroyed', (data) => { const { roomId, inhibitorId } = data; const room = gameRooms[roomId]; const myTimers = room?.inhibitorTimers[socket.id]; if (myTimers && myTimers[inhibitorId] !== undefined) delete myTimers[inhibitorId]; });
    socket.on('sendMinefield', (roomId) => { const CUSTO = 200; const MAX_MINES = 6; const MINE_DURATION = 20; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.minefieldDeploy < 1 || player.dinheiro < CUSTO) return; if (player.mineCount >= MAX_MINES) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const minesData = []; const minesToSend = 3; const isStealth = player.upgrades.ultimate_stealthMines > 0; for(let i = 0; i < minesToSend && player.mineCount < MAX_MINES; i++) { const mineId = `mine_${socket.id}_${Date.now()}_${i}`; minesData.push({ type: 'mine', id: mineId, ownerId: socket.id, health: 1, damage: 50, /* Dano PEM? */ radius: 40, bountyValue: 5, isStealth: isStealth }); if(room.mines && room.mines[socket.id]) { room.mines[socket.id][mineId] = { timer: MINE_DURATION }; player.mineCount++; } } io.to(opponentId).emit('receiveMines', minesData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('mineExpiredOrDetonated', (data) => {
        const { roomId, mineId, ownerId } = data; const room = gameRooms[roomId]; const ownerPlayer = room?.players[ownerId];
        if (room?.mines?.[ownerId]?.[mineId]) {
             delete room.mines[ownerId][mineId];
             if (ownerPlayer) { ownerPlayer.mineCount = Math.max(0, ownerPlayer.mineCount - 1); io.to(ownerId).emit('updateMineCount', ownerPlayer.mineCount); }
        }
    });
    socket.on('sendHunterAsteroid', (roomId) => { const CUSTO = 650; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.hunterAsteroid < 1 || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'hunter', count: 1, health: 40 + (player.upgrades.asteroidVida * 3), size: 1, shoots: false, bountyValue: 60, reinforcedHull: player.upgrades.reinforcedHull > 0 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('sendShieldDisruptor', (roomId) => { const CUSTO = 600; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.shieldDisruptor < 1 || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'disruptor', count: 1, health: 30, size: 1, shoots: false, bountyValue: 25, reinforcedHull: player.upgrades.reinforcedHull > 0 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });
    socket.on('sendSpectralShip', (roomId) => { const CUSTO = 500; const room = gameRooms[roomId]; const player = room?.players[socket.id]; if (!player || player.upgrades.spectralShip < 1 || player.dinheiro < CUSTO) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) { player.dinheiro -= CUSTO; const enemyData = { type: 'spectral', count: 1, health: 25, size: 1, shoots: true, bountyValue: 40, reinforcedHull: player.upgrades.reinforcedHull > 0 }; io.to(opponentId).emit('receiveEnemy', enemyData); io.to(roomId).emit('updateGameState', room.players); } });


    // Snapshot
    socket.on('sendSnapshot', (data) => { const { roomId, snapshot } = data; const room = gameRooms[roomId]; if (!room) return; const opponentId = Object.keys(room.players).find(id => id !== socket.id); if (opponentId) io.to(opponentId).emit('receiveSnapshot', snapshot); });
    
    // Desconexão
    socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            if (room.players[socket.id]) {
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                if(room.mines) delete room.mines[socket.id]; 
                if(room.inhibitorTimers) delete room.inhibitorTimers[socket.id];
                if(opponentId && room.mines?.[opponentId]) {
                    const minesToRemove = Object.keys(room.mines[opponentId]).filter(mineId => mineId.startsWith(`mine_${socket.id}`));
                    // Remove do estado do server
                    minesToRemove.forEach(mineId => delete room.mines[opponentId][mineId]);
                    // Informa o oponente
                    io.to(opponentId).emit('minesExpired', minesToRemove);
                }

                delete room.players[socket.id];
                if (opponentId) io.to(opponentId).emit('opponentLeft');
                if (Object.keys(room.players).length === 0) { delete gameRooms[roomId]; console.log(`Sala ${roomId} limpa.`); }
                break;
            }
        }
    });
});

// Loop de Renda
function startIncomeLoop(roomId) {
    const room = gameRooms[roomId]; if (!room) return;
    const intervalId = setInterval(() => {
        const currentRoom = gameRooms[roomId]; if (!currentRoom || !currentRoom.gameRunning) { clearInterval(intervalId); return; }
        let stateChanged = false;
        for (const playerId in currentRoom.players) {
            const player = currentRoom.players[playerId]; if (!player) continue;
            // Cooldowns
            if (player.converterCooldown > 0) { player.converterCooldown--; stateChanged = true; }
            if (player.shieldOverloadCooldown > 0) { player.shieldOverloadCooldown--; stateChanged = true; }
            if (player.hyperspaceCooldown > 0) { player.hyperspaceCooldown--; stateChanged = true; }
            if (player.stasisFieldCooldown > 0) { player.stasisFieldCooldown--; stateChanged = true; }
            if (player.merchantCallCooldown > 0) { player.merchantCallCooldown--; stateChanged = true; }
            if (player.energyReconfigCooldown > 0) { player.energyReconfigCooldown--; stateChanged = true; }
            if (player.rewardHackCooldown > 0) { player.rewardHackCooldown--; stateChanged = true; }
            if (player.orbitalMarkerCooldown > 0) { player.orbitalMarkerCooldown--; stateChanged = true; }
            
            // Debuff Renda
            let incomeMultiplier = 1.0; if (player.incomeDebuffDuration > 0) { player.incomeDebuffDuration--; incomeMultiplier = INCOME_DEBUFF_MULTIPLIER; stateChanged = true; }
            // Renda Normal
            player.dinheiro += Math.floor(player.upgrades.income * incomeMultiplier); stateChanged = true;
            // Banco
            if (player.upgrades.galacticBank > 0) { player.bankTimer--; if (player.bankTimer <= 0) { player.bankTimer = 10; const bankLevel = player.upgrades.galacticBank; const taxa = 0.01 + (bankLevel * 0.005); const teto = 20 + (bankLevel * 10); let juros = Math.floor(player.dinheiro * taxa); if (juros > teto) juros = teto; if (juros > 0) { player.dinheiro += juros; io.to(playerId).emit('showFloatingText', { text: `+ $${juros} (Juros)`, color: '#FFD700' }); } } stateChanged = true; }
            // Investimento de Risco
            if (player.upgrades.ultimate_riskyInvest > 0) {
                 player.riskyInvestTimer--;
                 if (player.riskyInvestTimer <= 0) {
                     player.riskyInvestTimer = RISKY_INVEST_TIMER; const roll = Math.random();
                     if (roll < RISKY_INVEST_CHANCES.fail) { let loss = Math.min(RISKY_INVEST_LOSS_CAP, Math.floor(player.dinheiro * RISKY_INVEST_LOSS_PERCENT)); player.dinheiro -= loss; if (player.dinheiro < 0) player.dinheiro = 0; io.to(playerId).emit('showFloatingText', { text: `- $${loss} (Risco Falhou!)`, color: '#FF0000', size: '1.4em' }); } 
                     else if (roll < RISKY_INVEST_CHANCES.fail + RISKY_INVEST_CHANCES.success) { player.dinheiro += RISKY_INVEST_BONUS; io.to(playerId).emit('showFloatingText', { text: `+ $${RISKY_INVEST_BONUS} (Risco Pagou!)`, color: '#00FF00', size: '1.4em' }); }
                      stateChanged = true;
                 }
            }
            // Timers Inibidores
            const inhibitorTimers = currentRoom.inhibitorTimers?.[playerId] || {};
            for (const inhibitorId in inhibitorTimers) { inhibitorTimers[inhibitorId]--; if (inhibitorTimers[inhibitorId] <= 0) { player.incomeDebuffDuration = INCOME_DEBUFF_DURATION; delete inhibitorTimers[inhibitorId]; io.to(playerId).emit('showFloatingText', { text: `RENDA REDUZIDA! (-50% por ${INCOME_DEBUFF_DURATION}s)`, color: '#FF0000', size: '1.3em' }); stateChanged = true; } }
            // Timers Minas
            const myMines = currentRoom.mines?.[playerId] || {}; let minesExpired = [];
            for (const mineId in myMines) { myMines[mineId].timer--; if (myMines[mineId].timer <= 0) { minesExpired.push(mineId); player.mineCount = Math.max(0, player.mineCount - 1); stateChanged = true; } }
            if (minesExpired.length > 0) { for (const mineId of minesExpired) delete myMines[mineId]; io.to(roomId).emit('minesExpired', minesExpired); }
        }
        if (stateChanged) io.to(roomId).emit('updateGameState', currentRoom.players);
    }, 1000); 
}

// Listener para Taxa de Atrito (Aplicado a cada socket individualmente)
io.on('connection', (socket) => {
    // Re-aplica listeners específicos para este socket
    const sendEvents = ['sendNormalEnemy', 'sendShooterEnemy', 'sendBomberEnemy', 'sendIncomeInhibitor', 'sendMinefield', 'sendHunterAsteroid', 'sendShieldDisruptor', 'sendSpectralShip'];
    sendEvents.forEach(eventName => {
        socket.on(eventName, (roomId) => { 
             const currentRoom = gameRooms[roomId];
             if (currentRoom?.gameRunning && currentRoom.players) {
                 const opponentId = Object.keys(currentRoom.players).find(playerId => playerId !== socket.id);
                 const opponentPlayer = currentRoom.players[opponentId];
                 if (opponentPlayer?.upgrades.attritionTax > 0) {
                     const gain = ATTRITION_TAX_PER_LEVEL[opponentPlayer.upgrades.attritionTax];
                     if (gain > 0) {
                         opponentPlayer.dinheiro += gain;
                         io.to(opponentId).emit('gainMoney', gain);
                         io.to(opponentId).emit('showFloatingText', { text: `+ $${gain} (Taxa)`, color: '#CCCCCC' });
                         // Não precisa de updateGameState aqui, o loop de 1s cuida disso
                     }
                 }
             }
        });
    });
});


server.listen(PORT, () => { console.log(`Servidor rodando na porta ${PORT}`); });