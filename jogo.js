const SERVER_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SERVER_URL)
                   ? process.env.NEXT_PUBLIC_SERVER_URL
                   : 'https://meu-jogo-pvp.onrender.com';

const socket = io(SERVER_URL); 
let meuSocketId = null;
let minhaRoomId = null;

const roomUI = document.getElementById('roomUI');
const roomIdInput = document.getElementById('roomIdInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomStatus = document.getElementById('roomStatus');

const gameWrapper = document.getElementById('gameWrapper');

const gameContainer = document.getElementById('gameAreaColumn');
const upgradeShop = document.getElementById('upgradeShop');
const gameStats = document.getElementById('gameStats');
const opponentStats = document.getElementById('opponentStats');
const gameActions = document.getElementById('gameActions');
const shopTooltip = document.getElementById('shopTooltip');
const floatingTextContainer = document.getElementById('floatingTextContainer');
const merchantContainer = document.getElementById('merchantContainer');
const merchantItemsEl = document.getElementById('merchantItems');
const merchantTimerEl = document.getElementById('merchantTimer');

const playerHudContainer = document.getElementById('playerHud');
const playerHudVida = document.getElementById('playerHudVida');
const playerHudEscudo = document.getElementById('playerHudEscudo');
const lowHealthVignette = document.getElementById('lowHealthVignette');

const playerVidasEl = document.getElementById('playerVidas');
const playerDinheiroEl = document.getElementById('playerDinheiro');
const playerRendaEl = document.getElementById('playerRenda');

const converterCooldownUI = document.getElementById('converterCooldownUI');
const converterStatusEl = converterCooldownUI.querySelector('.cooldown-status');
const overloadCooldownUI = document.getElementById('overloadCooldownUI');
const overloadStatusEl = overloadCooldownUI.querySelector('.cooldown-status');
const jumpCooldownUI = document.getElementById('jumpCooldownUI');
const jumpStatusEl = jumpCooldownUI.querySelector('.cooldown-status');
const stasisCooldownUI = document.getElementById('stasisCooldownUI');
const stasisStatusEl = stasisCooldownUI.querySelector('.cooldown-status');
const merchantCooldownUI = document.getElementById('merchantCooldownUI');
const merchantStatusEl = merchantCooldownUI.querySelector('.cooldown-status');
const reconfigCooldownUI = document.getElementById('reconfigCooldownUI');
const reconfigStatusEl = reconfigCooldownUI.querySelector('.cooldown-status');
const hackCooldownUI = document.getElementById('hackCooldownUI');
const hackStatusEl = hackCooldownUI.querySelector('.cooldown-status');
const orbitalCooldownUI = document.getElementById('orbitalCooldownUI');
const orbitalStatusEl = orbitalCooldownUI.querySelector('.cooldown-status');
const batteryChargeUI = document.getElementById('batteryChargeUI');
const batteryChargesEl = document.getElementById('batteryCharges');

const opponentVidasEl = document.getElementById('opponentVidas');
const opponentDinheiroEl = document.getElementById('opponentDinheiro');
const opponentRendaEl = document.getElementById('opponentRenda');
const bossHealthContainer = document.getElementById('bossHealthContainer');
const bossHealthBar = document.getElementById('bossHealthBar');
const opponentCanvas = document.getElementById('opponentCanvas');
const opponentCtx = opponentCanvas.getContext('2d');
const opponentDebuffUI = document.getElementById('opponentDebuffUI');
let opponentImage = new Image();

const btnSendEnemy = document.getElementById('btnSendEnemy');
const btnSendShooter = document.getElementById('btnSendShooter');
const btnSendBomber = document.getElementById('btnSendBomber');
const btnSendInhibitor = document.getElementById('btnSendInhibitor');
const btnSendMines = document.getElementById('btnSendMines');
const btnSendHunter = document.getElementById('btnSendHunter');
const btnSendDisruptor = document.getElementById('btnSendDisruptor');
const btnSendSpectral = document.getElementById('btnSendSpectral');

let meuEstado = {};
let estadoOponente = {};
let merchantTimerInterval = null;
let activePowerups = {
    rapidFire: { active: false, duration: 0 },
    instantShield: { active: false, duration: 0 }, 
    tempLife: { active: false, duration: 0 }
};
let batteryCannonCharges = 0;
let orbitalMarkerTarget = null;

let screenShake = 0;

const musicaFundo = new Audio('musica_fundo.mp3');
musicaFundo.loop = true;
musicaFundo.volume = 0.02;

const btnMute = document.getElementById('btnMute');
let isMuted = false;

btnMute.addEventListener('click', () => {
    isMuted = !isMuted; 
    musicaFundo.muted = isMuted;

    btnMute.textContent = isMuted ? 'Ligar Som' : 'Mutar Som';
    btnMute.style.backgroundColor = isMuted ? '#600' : '#060';
});

const UPGRADE_DEFINITIONS = {

    missil:         { maxLevel: 3, baseCost: 200, label: "Míssil (Dano Área)" },
    tiroDuplo:      { maxLevel: 1, baseCost: 150, label: "Tiro Duplo" },
    laser:          { maxLevel: 5, baseCost: 300, label: "Laser (Feixe Contínuo)" },
    homingMissile:  { maxLevel: 1, baseCost: 1000, label: "Míssil Teleguiado" },
    piercingShots:  { maxLevel: 1, baseCost: 750, label: "Projéteis Perfurantes" },
    cryoAmmo:       { maxLevel: 1, baseCost: 1200, label: "Munição Criogênica" },
    enhancedCharge: { maxLevel: 1, baseCost: 900, label: "Carga Expl. Aprimorada (Homing)" },
    napalmFragments:{ maxLevel: 1, baseCost: 1100, label: "Fragmentos Incendiários (Míssil)" },
    superchargeCore:{ maxLevel: 3, baseCost: 600, label: "Núcleo de Supercarga" },
    unstableMunitions:{ maxLevel: 1, baseCost: 850, label: "Munição Instável" },
    targetingComputer:{ maxLevel: 3, baseCost: 500, label: "Computador de Mira" },
    chainReaction:  { maxLevel: 1, baseCost: 1500, label: "Reação em Cadeia" },
    batteryCannons: { maxLevel: 1, baseCost: 700, label: "Canhões de Bateria (E)", dependency: 'escudo' },
    ricochetMissiles:{ maxLevel: 1, baseCost: 1300, label: "Micro-Mísseis Ricochete", dependency: 'missil' },
    laserAmplifier: { maxLevel: 3, baseCost: 400, label: "Amplificador Laser", dependency: 'laser' },
    deepFreeze:     { maxLevel: 1, baseCost: 800, label: "Congelamento Profundo (Crio)", dependency: 'cryoAmmo' },
    orbitalMarker:  { maxLevel: 1, baseCost: 1800, label: "Marcador Orbital (T)" },

    velocidade:     { maxLevel: 3, baseCost: 50, label: "Velocidade" },
    resistencia:    { maxLevel: 3, baseCost: 250, label: "Resistência (+1 Vida)" },
    escudo:         { maxLevel: 5, baseCost: 100, label: "Escudo" },
    matterConverter:{ maxLevel: 1, baseCost: 600, label: "Conversor de Matéria (R)" },
    hyperspaceJump: { maxLevel: 1, baseCost: 800, label: "Salto Hiper-Espacial (BTN Dir)" },
    repulsorField:  { maxLevel: 1, baseCost: 450, label: "Repulsor de Detritos" },
    stasisField:    { maxLevel: 1, baseCost: 700, label: "Campo de Stasis (C)" },
    energyReconfig: { maxLevel: 1, baseCost: 1000, label: "Reconfiguração Energia (X)" },
    kineticAccelerator:{ maxLevel: 1, baseCost: 950, label: "Acelerador Cinético", dependency: 'velocidade' },
    cargoCollector: { maxLevel: 1, baseCost: 300, label: "Coletor Automático Carga", dependency: 'starSmuggler' },

    enviarMais:     { maxLevel: 10, baseCost: 75, label: "+1 Asteroide" },
    asteroidVida:   { maxLevel: 10, baseCost: 100, label: "+Vida Asteroide" },
    asteroidMaior:  { maxLevel: 5, baseCost: 150, label: "+Tamanho Asteroide" },
    sendCooldown:   { maxLevel: 5, baseCost: 200, label: "Reduzir Cooldown (Envio)" },
    bomberAsteroid: { maxLevel: 1, baseCost: 400, label: "Desbloquear Asteroide-Bomba" },
    incomeInhibitor:{ maxLevel: 1, baseCost: 350, label: "Desbloquear Inibidor Renda" },
    minefieldDeploy:{ maxLevel: 1, baseCost: 200, label: "Desbloquear Campo Minado" },
    advancedTargeting:{ maxLevel: 1, baseCost: 550, label: "Mira Laser Avançada (Atirador)" },
    hunterAsteroid: { maxLevel: 1, baseCost: 650, label: "Desbloquear Ast. Caçador" },
    impactShrapnel: { maxLevel: 1, baseCost: 500, label: "Impacto Fragmentado" },
    ricochetShots:  { maxLevel: 1, baseCost: 1400, label: "Tiros Ricochete (Atirador)", dependency: 'advancedTargeting'},
    volatileCore:   { maxLevel: 3, baseCost: 450, label: "Núcleo Volátil" },
    shieldDisruptor:{ maxLevel: 1, baseCost: 600, label: "Desbloquear Disruptor Escudo" },
    reinforcedHull: { maxLevel: 1, baseCost: 1600, label: "Blindagem Reforçada" },
    toxicShards:    { maxLevel: 1, baseCost: 750, label: "Estilhaços Tóxicos (Bomba)", dependency: 'bomberAsteroid' },
    spectralShip:   { maxLevel: 1, baseCost: 500, label: "Desbloquear Nave Espectral" },

    income:         { maxLevel: 99, baseCost: 10, label: "Upgrade Renda" },
    bounty:         { maxLevel: 5, baseCost: [300, 500, 800, 1300, 2100], label: "Recompensa (+10%)" },
    galacticBank:   { maxLevel: 5, baseCost: 300, label: "Banco Galáctico (Juros)" },
    starSmuggler:   { maxLevel: 1, baseCost: 500, label: "Contrabandista Estelar" },
    merchantCall:   { maxLevel: 1, baseCost: 900, label: "Chamado do Mercador (B)" },
    combatRecycler: { maxLevel: 3, baseCost: 400, label: "Reciclador de Combate" },
    rewardHack:     { maxLevel: 1, baseCost: 800, label: "Hack de Recompensa (V)" },
    attritionTax:   { maxLevel: 3, baseCost: 350, label: "Taxa de Atrito" },

    masterOfArms:   { maxLevel: 1, baseCost: 5000, label: "Mestre das Armas (2º Exclusivo)" },

    ultimate_cluster: { maxLevel: 1, baseCost: 2500, label: "Canhão de Fragmentação", dependency: 'tiroDuplo' },
    ultimate_laser:   { maxLevel: 1, baseCost: 2500, label: "Laser Purgatório", dependency: 'laser' },
    ultimate_prism:   { maxLevel: 1, baseCost: 1500, label: "Prisma Divisor", dependency: 'ultimate_laser' },
    ultimate_barrage: { maxLevel: 1, baseCost: 2500, label: "Barragem de Saturação", dependency: 'missil' },
    ultimate_swarm:   { maxLevel: 1, baseCost: 2500, label: "Enxame Teleguiado", dependency: 'homingMissile' },
    ultimate_singularity: { maxLevel: 1, baseCost: 3000, label: "Disparo de Singularidade", dependency: 'homingMissile' },

    ultimate_shield:  { maxLevel: 1, baseCost: 2000, label: "Sobrecarga de Escudo (Shift)", dependency: 'escudo' },

    ultimate_stealthMines: { maxLevel: 1, baseCost: 1800, label: "Minas Camufladas", dependency: 'minefieldDeploy' },
    ultimate_barrageCoord: { maxLevel: 1, baseCost: 2000, label: "Barragem Coordenada (Atirador)", dependency: 'advancedTargeting' },

    ultimate_blackMarket:  { maxLevel: 1, baseCost: 2200, label: "Mercado Negro", dependency: 'starSmuggler' },
    ultimate_riskyInvest:  { maxLevel: 1, baseCost: 1800, label: "Investimento de Risco", dependency: 'galacticBank' },
    ultimate_effConversion:{ maxLevel: 1, baseCost: 1500, label: "Conversão Eficiente", dependency: 'combatRecycler' }
};

const UPGRADE_DESCRIPTIONS = {

    missil: "Adiciona um lançador de mísseis à sua nave. Mísseis causam dano em área.",
    tiroDuplo: "Dispara dois projéteis de uma vez. (Máx 1)",
    laser: "Ativa um feixe de laser contínuo (enquanto segura o mouse) que causa dano por segundo e perfura inimigos.",
    homingMissile: "NOVA ARMA: Dispara um míssil teleguiado (com cooldown próprio) que persegue o asteroide mais próximo.",
    piercingShots: "Seus projéteis básicos (tiro normal/duplo/fragmentos) perfuram 1 inimigo. (Máx 1)",
    cryoAmmo: "Seus projéteis aplicam Lentidão (30%) aos inimigos atingidos por 3s. Não acumula.", 
    enhancedCharge: "Seus Mísseis Teleguiados (normal e Enxame) causam uma pequena explosão (~30px) ao atingir o alvo.",
    napalmFragments: "A explosão do seu Míssil (normal e Barragem) deixa fogo espacial que causa dano contínuo por 3s.",
    superchargeCore: "Aumenta a velocidade (+10%/nível) e dano (+5%/nível) de todos os projéteis da sua nave.",
    unstableMunitions: "Seus projéteis básicos (não-mísseis) têm 15% de chance de explodir ao impacto (dano leve, área pequena).",
    targetingComputer: "Melhora a curva dos Mísseis Teleguiados (+5%/nível). Reduz a dispersão de projéteis normais.",
    chainReaction: "Quando um projétil seu destrói um asteroide, 20% de chance de causar uma segunda explosão (dano baixo).",
    batteryCannons: "HABILIDADE [E]: Absorver dano no escudo gera cargas (máx 3). Use [E] para disparar um tiro potente consumindo as cargas.",
    ricochetMissiles: "A explosão dos seus Mísseis AoE solta 2 micro-mísseis que ricocheteiam 1 vez.",
    laserAmplifier: "Aumenta o alcance (+15%/nível) e a espessura do feixe Laser.",
    deepFreeze: "Aumenta a duração da Lentidão Crio para 3s. Asteroides pequenos têm 20% de chance de congelar por 1s.",
    orbitalMarker: "HABILIDADE [T]: Dispara um marcador. Se acertar um asteroide, um laser orbital atinge o local após 2s (dano imenso). Cooldown: 45s.",

    velocidade: "Aumenta sua velocidade de aceleração e velocidade máxima.",
    resistencia: "Aumenta sua vida máxima permanentemente em +1 por nível.",
    escudo: "Cria um escudo que absorve dano. Regenera 1 ponto a cada 5s até o seu máximo.",
    matterConverter: "HABILIDADE [R]: Absorve todos os asteroides neutros na tela, ganhando $25 por cada. Cooldown: 20s.",
    hyperspaceJump: "HABILIDADE [BTN Dir]: Teleporta a nave uma curta distância na direção do mouse. Cooldown: 10s.",
    repulsorField: "Empurra passivamente asteroides pequenos (tamanho 25) para longe da nave.",
    stasisField: "HABILIDADE [C]: Cria uma bolha temporal por 3s. Tudo dentro (exceto sua nave) fica 90% mais lento. Você fica 50% mais lento. Cooldown: 25s.",
    energyReconfig: "HABILIDADE [X]: Por 5s, desativa regen de escudo, mas aumenta cadência (+50%) e velocidade (+30%). Cooldown: 45s.",
    kineticAccelerator: "Colidir com asteroides enquanto acelera [W] causa dano bônus massivo baseado na velocidade. Reduz dano recebido na colisão em 30%.",
    cargoCollector: "Containers de Carga (Loot) são puxados magneticamente para a nave de perto.",

    enviarMais: "Envia +1 asteroide normal para o oponente por clique (não afeta outras unidades).",
    asteroidVida: "Aumenta a vida das unidades que você envia.",
    asteroidMaior: "Aumenta o tamanho das unidades que você envia.",
    sendCooldown: "Diminui o tempo de recarga para enviar unidades em 0.8s por nível.",
    bomberAsteroid: "Desbloqueia a unidade 'Asteroide-Bomba' (Custo Envio: $400). Explode após 8s ou ao ser destruída.",
    incomeInhibitor: "Desbloqueia a unidade 'Inibidor de Renda' (Custo Envio: $350). Se sobreviver 15s, reduz a renda do oponente em 50% por 10s.",
    minefieldDeploy: "Desbloqueia o envio de 'Campo Minado' (Custo Envio: $200). Envia 3 minas que explodem ao contato. Máx 6 ativas.",
    advancedTargeting: "Seus Asteroides Atiradores disparam projéteis 30% mais rápidos e precisos.",
    hunterAsteroid: "Desbloqueia a unidade 'Asteroide Caçador' (Custo Envio: $650). Persegue ativamente a nave inimiga.",
    impactShrapnel: "Asteroides Normais enviados soltam 3 estilhaços de dano mínimo ao serem destruídos.",
    ricochetShots: "Projéteis dos seus Atiradores ricocheteiam 1 vez nas bordas.",
    volatileCore: "Asteroides Normais/Atiradores enviados têm 15%/30%/50% chance de explodir (dano baixo, área pequena) ao serem destruídos.",
    shieldDisruptor: "Desbloqueia a unidade 'Disruptor de Escudo' (Custo Envio: $600). Remove 1 ponto de escudo inimigo se alcançar o meio do campo.",
    reinforcedHull: "Todas as unidades enviadas (exceto Minas) recebem +1 armadura (reduz dano de projéteis básicos em 1).",
    toxicShards: "Estilhaços da explosão da sua Bomba aplicam Corrosão (dano leve por 3s, impede regen de escudo).",
    spectralShip: "Desbloqueia a 'Nave Espectral' (Custo Envio: $500). Atravessa asteroides e dispara projéteis que ignoram escudo.",

    income: "Aumenta sua renda passiva de dinheiro por segundo.",
    bounty: "Aumenta o dinheiro ganho ao destruir asteroides enviados pelo oponente em +10% por nível.",
    galacticBank: "Ganha juros (1.5% a 3.5%) sobre seu dinheiro a cada 10s. O teto de ganho aumenta por nível.",
    starSmuggler: "Asteroides neutros têm 10% de chance de dropar um Container de Carga ($50-$100) ao serem destruídos.",
    merchantCall: "HABILIDADE [B]: Chama um Mercador por 10s que oferece bônus temporários por dinheiro. Cooldown: 60s.",
    combatRecycler: "Ganha $1/$2/$3 por cada projétil inimigo destruído.",
    rewardHack: "HABILIDADE [V]: Dispara pulso de curto alcance. Se atingir asteroide inimigo, você recebe a recompensa (Bounty) ao invés dele. Cooldown: 30s.",
    attritionTax: "Ganha $1/$2/$3 sempre que o oponente envia uma unidade.",

    masterOfArms: "Permite comprar um segundo Upgrade Exclusivo (não-adicional). Requer ter comprado o primeiro.",
    ultimate_cluster: "EXCLUSIVO: Dispara projétil pesado (dano 10), explode (50px) E fragmenta em 12 tiros. Perfura 1. (Requer: Tiro Duplo Nv.Máx)",
    ultimate_laser:   "EXCLUSIVO: Laser Purgatório branco. Dano massivo e DESTROI projéteis inimigos. (Requer: Laser Nv.Máx)",
    ultimate_prism:   "EXCLUSIVO ADICIONAL: Laser Purgatório se divide em 2 feixes secundários (50% dano). (Requer: Laser Purgatório ATIVO)",
    ultimate_barrage: "EXCLUSIVO: Mísseis com +50% área, +50% velocidade e 3x mais cadência. (Requer: Míssil Nv.Máx)",
    ultimate_swarm:   "EXCLUSIVO: Dispara enxame de 5 mísseis teleguiados que buscam os 5 alvos mais próximos. (Requer: Míssil Teleguiado Nv.Máx)",
    ultimate_singularity: "EXCLUSIVO: Substitui Homing por Disparo de Singularidade: projétil lento que puxa inimigos e implode (dano massivo). Cooldown 2s. (Requer: Míssil Teleguiado Nv.Máx)",
    ultimate_shield:  "EXCLUSIVO / HABILIDADE [Shift]: Consome escudo para explosão EMP que destrói projéteis. Cooldown: 15s. (Requer: Escudo Nv.Máx)",
    ultimate_stealthMines: "EXCLUSIVO ADICIONAL: Suas minas ficam invisíveis até inimigo se aproximar. (Requer: Campo Minado ATIVO)",
    ultimate_barrageCoord: "EXCLUSIVO: Seus Atiradores disparam rajadas de 3 tiros rápidos. (Requer: Mira Avançada ATIVO)",
    ultimate_blackMarket:  "EXCLUSIVO ADICIONAL: Chance de drop de Container aumenta para 25%. Containers têm 10% de chance de dar Power-up. (Requer: Contrabandista ATIVO)",
    ultimate_riskyInvest:  "EXCLUSIVO: A cada 30s, 60% chance de ganhar $500, 10% de perder $200 (ou 20%). (Requer: Banco Galáctico Nv.Máx)",
    ultimate_effConversion:"EXCLUSIVO ADICIONAL: Aumenta ganho do Reciclador para $3/$4/$5. Projéteis destruídos têm 10% de chance de recuperar 1 escudo. (Requer: Reciclador ATIVO)"
};

function getUpgradeCost(upgradeKey, currentLevel) {
    if (!UPGRADE_DEFINITIONS[upgradeKey]) return Infinity;
    const def = UPGRADE_DEFINITIONS[upgradeKey];
    if (Array.isArray(def.baseCost)) {
        return def.baseCost[currentLevel] || Infinity;
    }

    if (['galacticBank', 'combatRecycler', 'volatileCore', 'attritionTax', 'targetingComputer', 'laserAmplifier', 'superchargeCore'].includes(upgradeKey)) {
        return Math.floor(def.baseCost * Math.pow(1.5, currentLevel)); 
    }
    return Math.floor(def.baseCost * Math.pow(1.15, currentLevel)); 
}

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        minhaRoomId = roomId;
        socket.emit('joinRoom', roomId);
        roomStatus.textContent = 'Entrando...';
    }
});

btnSendEnemy.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendNormalEnemy', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendShooter.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendShooterEnemy', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendBomber.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendBomberEnemy', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendInhibitor.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendIncomeInhibitor', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendMines.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendMinefield', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendHunter.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendHunterAsteroid', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendDisruptor.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendShieldDisruptor', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

btnSendSpectral.addEventListener('click', () => {
    if (sendEnemyCooldownTimer > 0) return;
    socket.emit('sendSpectralShip', minhaRoomId);
    sendEnemyCooldownTimer = maxSendEnemyCooldown;
});

document.querySelectorAll('button[id^="btnBuy-"]').forEach(button => {
    const upgradeKey = button.id.split('-')[1];
    button.addEventListener('click', () => {
        socket.emit('buyUpgrade', {
            roomId: minhaRoomId,
            upgradeKey: upgradeKey
        });
    });
});

function setupTooltipListeners() {

    const tabButtons = document.querySelectorAll('.shop-nav-btn'); 
    const tabContents = document.querySelectorAll('.shop-tab-content'); 

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');

            const contentId = "tab" + button.id.substring(6);
            const activeContent = document.getElementById(contentId);

            if (activeContent) {
                activeContent.classList.add('active');
            }
        });
    });

    document.querySelectorAll('#upgradeShop button').forEach(button => {
        const upgradeKey = button.id.split('-')[1];
        const description = UPGRADE_DESCRIPTIONS[upgradeKey];
        if (!description) return;

        button.addEventListener('mouseover', (e) => {
            shopTooltip.innerHTML = description;
            shopTooltip.style.display = 'block';
        });
        button.addEventListener('mousemove', (e) => {

            shopTooltip.style.left = (e.pageX + 15) + 'px';
            shopTooltip.style.top = (e.pageY + 15) + 'px';
        });
        button.addEventListener('mouseout', (e) => {
            shopTooltip.style.display = 'none';
        });
    });

}

socket.on('connect', () => { meuSocketId = socket.id; });

socket.on('gameStart', (roomState) => {
    roomUI.style.display = 'none';
    gameContainer.style.display = 'block'; 
    gameWrapper.style.display = 'block'; 
    upgradeShop.style.display = 'flex'; 
    gameStats.style.display = 'block';
    opponentStats.style.display = 'block';
    gameActions.style.display = 'block';
    bossHealthContainer.style.display = 'flex';
    playerHudContainer.style.display = 'block'; 
    iniciarJogoMultiplayer();
    setupTooltipListeners(); 

    musicaFundo.currentTime = 0;
    musicaFundo.play().catch(error => {
        console.warn("Música bloqueada pelo navegador. O usuário precisa interagir mais.", error);
    });
});

socket.on('updateGameState', (gameState) => {
    let players = gameState.players || gameState;
    if (!players[meuSocketId]) {
        console.warn("Recebido gameState sem meu ID.");
        return; 
    }
    meuEstado = players[meuSocketId];
    let oponente = Object.values(players).find(p => p.id !== meuSocketId); 

    playerVidasEl.textContent = meuEstado.vidas;
    playerDinheiroEl.textContent = meuEstado.dinheiro;
    let effectiveIncome = meuEstado.upgrades.income;
    if (meuEstado.incomeDebuffDuration > 0) effectiveIncome *= 0.5;
    playerRendaEl.textContent = effectiveIncome.toFixed(0);

    if (meuEstado.vidas === 1) {
    lowHealthVignette.style.display = 'block';
} else {
    lowHealthVignette.style.display = 'none';
}

    if (meuEstado.upgrades.sendCooldown !== undefined) {
        const base = 5.0, reduc = 0.8;
        maxSendEnemyCooldown = base - (meuEstado.upgrades.sendCooldown * reduc);
        if (maxSendEnemyCooldown < 1.0) maxSendEnemyCooldown = 1.0;
    }

    if (oponente) {
        opponentVidasEl.textContent = oponente.vidas;
        opponentDinheiroEl.textContent = oponente.dinheiro;
        opponentRendaEl.textContent = oponente.upgrades.income;
        const vidaMaximaOponente = 3 + (oponente.upgrades?.resistencia || 0); 
        const vidaPercent = (oponente.vidas / vidaMaximaOponente) * 100;
        bossHealthBar.style.height = `${vidaPercent}%`;
        opponentDebuffUI.style.display = (oponente.incomeDebuffDuration > 0) ? 'block' : 'none';
    } else {
        opponentDebuffUI.style.display = 'none';
    }

    for (const key in UPGRADE_DEFINITIONS) {
        const button = document.getElementById(`btnBuy-${key}`);
        if (!button) continue;
        const def = UPGRADE_DEFINITIONS[key];
        const currentLevel = (meuEstado.upgrades?.[key] !== undefined) ? meuEstado.upgrades[key] : 0;
        const cost = getUpgradeCost(key, currentLevel);
        const isMaxed = currentLevel >= def.maxLevel;
        button.disabled = meuEstado.dinheiro < cost || isMaxed;

        if (key === 'masterOfArms') {
             button.disabled = meuEstado.dinheiro < cost || isMaxed || !meuEstado.hasUltimate; 
             button.textContent = `${def.label} (Custo: ${cost})`;
             if(isMaxed) button.textContent = `${def.label} [ATIVO]`;
             else if (!meuEstado.hasUltimate) button.textContent = `${def.label} (Requer 1º Exclusivo)`;
        }
        else if (key.startsWith('ultimate_')) {
            const dependencyKey = def.dependency;
            const dependencyDef = UPGRADE_DEFINITIONS[dependencyKey];
            const isAdditionalUltimate = ['ultimate_prism', 'ultimate_stealthMines', 'ultimate_blackMarket', 'ultimate_effConversion', 'ultimate_riskyInvest', 'ultimate_barrageCoord'].includes(key);
            const dependencyLevel = meuEstado.upgrades?.[dependencyKey];
            const requiredLevel = isAdditionalUltimate ? 1 : dependencyDef.maxLevel;
            const isDependencyMet = dependencyLevel >= requiredLevel;
            const canBuyUltimate = meuEstado.ultimateCount < (meuEstado.canHaveSecondUltimate ? 2 : 1);
            const isAlternative = (key === 'ultimate_swarm' && meuEstado.upgrades?.ultimate_singularity > 0) || (key === 'ultimate_singularity' && meuEstado.upgrades?.ultimate_swarm > 0);

            button.classList.remove('active-ultimate', 'locked-ultimate');

            if (isMaxed) { button.textContent = `${def.label} [ATIVO]`; button.disabled = true; button.classList.add('active-ultimate'); }
            else if (!isAdditionalUltimate && !canBuyUltimate && !isAlternative) { button.textContent = `${def.label} [SLOT BLOQUEADO]`; button.disabled = true; button.classList.add('locked-ultimate'); }
            else if (!isDependencyMet) { const reqText = isAdditionalUltimate ? `${dependencyDef.label}` : `${dependencyDef.label} Nv.Máx`; button.textContent = `${def.label} (Requer: ${reqText})`; button.disabled = true; }
            else { const buyText = isAlternative ? "Substituir" : "Comprar"; button.textContent = `${buyText}: ${def.label} (Custo: ${cost})`; button.disabled = meuEstado.dinheiro < cost; }
        } else { 
            button.textContent = `${def.label} [${currentLevel}/${def.maxLevel}] (Custo: ${cost})`;
            if (isMaxed) button.textContent = `${def.label} [MAX]`;
        }
    }

    btnSendBomber.style.display = (meuEstado.upgrades?.bomberAsteroid > 0) ? 'inline-block' : 'none';
    btnSendInhibitor.style.display = (meuEstado.upgrades?.incomeInhibitor > 0) ? 'inline-block' : 'none';
    btnSendMines.style.display = (meuEstado.upgrades?.minefieldDeploy > 0) ? 'inline-block' : 'none';
    btnSendHunter.style.display = (meuEstado.upgrades?.hunterAsteroid > 0) ? 'inline-block' : 'none';
    btnSendDisruptor.style.display = (meuEstado.upgrades?.shieldDisruptor > 0) ? 'inline-block' : 'none';
    btnSendSpectral.style.display = (meuEstado.upgrades?.spectralShip > 0) ? 'inline-block' : 'none';

    function updateCooldownUI(uiElement, statusElement, upgradeKey, cooldownValue) {
        if (!uiElement || !statusElement) return;
        if (meuEstado.upgrades?.[upgradeKey] > 0) {
            uiElement.style.display = 'block';
            if (cooldownValue > 0) { statusElement.textContent = `${cooldownValue.toFixed(1)}s`; statusElement.className = 'cooldown-status cooldown-charging'; }
            else { statusElement.textContent = 'PRONTO'; statusElement.className = 'cooldown-status cooldown-ready'; }
        } else { uiElement.style.display = 'none'; }
    }
    updateCooldownUI(converterCooldownUI, converterStatusEl, 'matterConverter', meuEstado.converterCooldown);
    updateCooldownUI(overloadCooldownUI, overloadStatusEl, 'ultimate_shield', meuEstado.shieldOverloadCooldown);
    updateCooldownUI(jumpCooldownUI, jumpStatusEl, 'hyperspaceJump', meuEstado.hyperspaceCooldown);
    updateCooldownUI(stasisCooldownUI, stasisStatusEl, 'stasisField', meuEstado.stasisFieldCooldown);
    updateCooldownUI(merchantCooldownUI, merchantStatusEl, 'merchantCall', meuEstado.merchantCallCooldown);
    updateCooldownUI(reconfigCooldownUI, reconfigStatusEl, 'energyReconfig', meuEstado.energyReconfigCooldown);
    updateCooldownUI(hackCooldownUI, hackStatusEl, 'rewardHack', meuEstado.rewardHackCooldown);
    updateCooldownUI(orbitalCooldownUI, orbitalStatusEl, 'orbitalMarker', meuEstado.orbitalMarkerCooldown);

     if (meuEstado.upgrades?.batteryCannons > 0) {
        batteryChargeUI.style.display = 'block';
        batteryChargesEl.textContent = batteryCannonCharges; 
    } else {
         batteryChargeUI.style.display = 'none';
    }
});

socket.on('receiveSnapshot', (snapshot) => {
    opponentImage.src = snapshot;
    opponentImage.onload = () => { try { opponentCtx.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height); opponentCtx.drawImage(opponentImage, 0, 0, opponentCanvas.width, opponentCanvas.height); } catch (e) { console.error("Erro ao desenhar snapshot:", e); } }
    opponentImage.onerror = (err) => { console.error("Erro ao carregar snapshot:", err); opponentCtx.fillStyle = 'red'; opponentCtx.fillRect(0, 0, opponentCanvas.width, opponentCanvas.height); opponentCtx.fillStyle = 'white'; opponentCtx.font = "12px Courier New"; opponentCtx.textAlign = "center"; opponentCtx.fillText("Erro Snapshot", opponentCanvas.width / 2, opponentCanvas.height / 2); };
});

socket.on('receiveEnemy', (data) => {
    for (let i = 0; i < data.count; i++) {
        if (asteroides.length >= 30) break;
        let tamanhoBase = TAMANHO_ASTEROIDE_BASE;
        if (['inhibitor', 'hunter', 'disruptor', 'spectral'].includes(data.type)) tamanhoBase = 50;
        let tamanho = (data.type === 'mine') ? 20 : (tamanhoBase * (1 + (data.size - 1) * 0.2));
        let options = { tipo: data.type || 'normal', id: data.id, advancedTargeting: data.advancedTargeting || false, toxicShards: data.toxicShards || false, reinforcedHull: data.reinforcedHull || false };
        let novoAsteroide = criarNovoAsteroide(tamanho, undefined, undefined, options);
        novoAsteroide.vida = data.health; novoAsteroide.vidaMaxima = data.health;
        novoAsteroide.atira = data.shoots; novoAsteroide.cooldownTiro = Math.random() * 2 + 1;
        novoAsteroide.nivelAtirador = data.shooterLevel; novoAsteroide.bountyValue = data.bountyValue;
        asteroides.push(novoAsteroide);
    }
});
socket.on('receiveMines', (minesData) => {
     for (const data of minesData) {
         if (minasEnviadas.length >= 6) break;
         const x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
         const y = Math.random() * (canvas.height * 0.4) + (canvas.height * 0.1);
         minasEnviadas.push(criarMina(x, y, data));
     }
});
socket.on('minesExpired', (mineIds) => { minasEnviadas = minasEnviadas.filter(mina => !mineIds.includes(mina.id)); });
socket.on('playerJumped', (data) => {
    if (data.playerId === meuSocketId) {
        criarSaltoVisual(nave.x, nave.y); nave.x = data.x; nave.y = data.y;
        nave.invencivel = true; nave.contadorInvencibilidade = FPS * 0.2; criarSaltoVisual(nave.x, nave.y);
    } else { criarSaltoVisual(data.x, data.y); }
});
socket.on('absorbNeutrals', (asteroidIds) => {
    for (const id of asteroidIds) {
        const asteroide = asteroidesNeutros.find(a => a.id === id);
        if (asteroide) { const index = asteroidesNeutros.indexOf(asteroide); if (index > -1) { explosoes.push({ x: asteroide.x, y: asteroide.y, raio: asteroide.raio * 1.5, vida: 10, vidaMax: 10, cor: "#00FF00" }); asteroidesNeutros.splice(index, 1); } }
    }
});
socket.on('showFloatingText', (data) => {
    const textEl = document.createElement('div'); textEl.className = 'floating-text'; textEl.textContent = data.text; textEl.style.color = data.color || 'white'; if (data.size) textEl.style.fontSize = data.size;
    floatingTextContainer.appendChild(textEl);
    setTimeout(() => { if (floatingTextContainer.contains(textEl)) floatingTextContainer.removeChild(textEl); }, 2000);
});
socket.on('gainMoney', (amount) => { if (meuEstado && meuEstado.dinheiro !== undefined) { meuEstado.dinheiro += amount; playerDinheiroEl.textContent = meuEstado.dinheiro; } });
socket.on('spawnLootContainer', (data) => { lootContainers.push(criarLootContainer(data.x, data.y, data.amount, data.type, data.powerupType)); });
socket.on('activatePowerup', (powerupType) => { activatePowerupEffect(powerupType); });
socket.on('stasisFieldActivated', (data) => { activateStasisEffect(data.playerId); });
socket.on('spawnMerchant', () => { spawnMerchantVisual(); });
socket.on('removeMerchant', () => { removeMerchantVisual(); });
socket.on('playerReconfigured', (data) => {
    if (data.playerId === meuSocketId) {
         nave.energyReconfigActive = data.active; 
         nave.energyReconfigEnd = data.active ? Date.now() + ENERGY_RECONFIG_DURATION * 1000 : 0;
    } else {

    }
});
socket.on('asteroidHacked', (data) => {
    const target = asteroides.find(a => a.id === data.asteroidId);
    if (target) {
        target.isHacked = true;
        target.hackerId = data.hackerId;
    }
});
socket.on('orbitalMarkerPlaced', (data) => {
    orbitalMarkerTarget = { x: data.x, y: data.y, endTime: Date.now() + ORBITAL_STRIKE_DELAY * 1000 };
});
socket.on('updateMineCount', (count) => { if(meuEstado) meuEstado.mineCount = count; });

socket.on('gameOver', (data) => { gameRunning = false; if (gameInterval) clearInterval(gameInterval); playerHudContainer.style.display = 'none'; modalTitulo.textContent = (data.winner === meuSocketId) ? "VOCÊ VENCEU!" : "VOCÊ PERDEU!"; modalPontuacao.textContent = "A batalha terminou."; modal.style.display = 'flex'; musicaFundo.pause(); lowHealthVignette.style.display = 'none'; });
socket.on('opponentLeft', () => { gameRunning = false; if (gameInterval) clearInterval(gameInterval); playerHudContainer.style.display = 'none'; modalTitulo.textContent = "OPONENTE DESISTIU"; modalPontuacao.textContent = "Você venceu por W.O."; modal.style.display = 'flex'; musicaFundo.pause(); });
socket.on('roomFull', () => { roomStatus.textContent = 'Sala cheia. Tente outra.'; });

socket.on('disconnect', (reason) => {
    console.warn('Socket desconectado:', reason);
    gameRunning = false;
    if (gameInterval) clearInterval(gameInterval);
    playerHudContainer.style.display = 'none'; 
    modalTitulo.textContent = "CONEXÃO PERDIDA";
    modalPontuacao.textContent = "A conexão com o servidor foi perdida.";
    modal.style.display = 'flex';
    musicaFundo.pause();
});

function keepAlive() {
    fetch(SERVER_URL + '/keep-alive')
        .then(res => {
            if (!res.ok) {
                throw new Error(`Status ${res.status}`);
            }
            return res.json();
        })
        .then(data => console.log('Keep-alive ping:', data.status))
        .catch(err => {
            console.warn(`Keep-alive ping falhou ou resposta não é JSON: ${err.message}`);
         });
}
setInterval(keepAlive, 300000);

const canvas = document.getElementById('canvasJogo');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('modalFimDeJogo');
const modalTitulo = document.getElementById('modalTitulo');
const modalPontuacao = document.getElementById('modalPontuacao');
const botaoReiniciar = document.getElementById('botaoReiniciar');

const FPS = 30; const DURACAO_INVENCIBILIDADE = FPS * 2; const TAMANHO_NAVE = 30;
const ACELERACAO_NAVE = 10; const ATRITO = 0.7; const NUM_ASTEROIDES_INICIAL = 3;
const VELOCIDADE_ASTEROIDE = 50; const TAMANHO_ASTEROIDE_BASE = 100; const DURACAO_LASER = 0.8;
const deltaTime = 1 / FPS; const CRYO_SLOW_FACTOR = 0.7; const CRYO_DURATION = 3.0;
const EMP_RADIUS = 250; const HYPERSPACE_DISTANCE = 150; const LOOT_DURATION = 5.0;
const MINE_ARM_TIME = 1.0; const MINE_TRIGGER_RADIUS = 30; const MINE_EXPLOSION_RADIUS = 40;
const PRISM_ANGLE = Math.PI / 6; const PRISM_DAMAGE_FACTOR = 0.5;
const STASIS_DURATION = 3.0; const STASIS_SLOW_FACTOR = 0.1; const STASIS_SELF_SLOW = 0.5;
const NAPALM_DURATION = 3.0; const NAPALM_DAMAGE = 0.5;
const POWERUP_DURATION = { rapidFire: 5.0, tempLife: 10.0 };
const ENERGY_RECONFIG_DURATION = 5.0;
const TOXIC_SHARD_DURATION = 3.0; const TOXIC_SHARD_DAMAGE = 0.2;
const REWARD_HACK_RANGE = 150;
const ORBITAL_STRIKE_DELAY = 2.0; const ORBITAL_STRIKE_RADIUS = 50; const ORBITAL_STRIKE_DAMAGE = 300;
const SINGULARITY_PULL_RADIUS = 150; const SINGULARITY_PULL_FORCE = 0.5; const SINGULARITY_IMPLOSION_RADIUS = 100;

let nave; let asteroides = []; let asteroidesNeutros = [];
let tirosInimigos = []; let explosoes = []; let lootContainers = []; let minasEnviadas = [];
let secondaryLaserBeams = []; let napalmAreas = [];
let gameRunning = false; let isLaserActive = false;
let teclas = { 'w': false, 'a': false, 's': false, 'd': false, ' ': false, 'r': false, 'shift': false, 'c': false, 'b': false, 'x': false, 'v': false, 't': false, 'e': false };
let rightMouseDown = false;
let mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
let frameCount = 0; let gameInterval;
let sendEnemyCooldownTimer = 5.0; let maxSendEnemyCooldown = 5.0;
let neutralAsteroidSpawnTimer = 15.0;
let activeStasisField = null;
let merchantVisible = false;

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (key === 'shift') { teclas['shift'] = true; if (meuEstado.upgrades?.ultimate_shield > 0 && meuEstado.shieldOverloadCooldown <= 0) activateShieldOverload(); }
    else if (key === 'r') { teclas['r'] = true; if (meuEstado.upgrades?.matterConverter > 0 && meuEstado.converterCooldown <= 0) activateMatterConverter(); }
    else if (key === 'c') { teclas['c'] = true; if (meuEstado.upgrades?.stasisField > 0 && meuEstado.stasisFieldCooldown <= 0) activateStasisField(); }
    else if (key === 'b') { teclas['b'] = true; if (meuEstado.upgrades?.merchantCall > 0 && meuEstado.merchantCallCooldown <= 0 && !merchantVisible) activateMerchantCall(); }
    else if (key === 'x') { teclas['x'] = true; if (meuEstado.upgrades?.energyReconfig > 0 && meuEstado.energyReconfigCooldown <= 0) activateEnergyReconfig(); }
    else if (key === 'v') { teclas['v'] = true; if (meuEstado.upgrades?.rewardHack > 0 && meuEstado.rewardHackCooldown <= 0) activateRewardHack(); }
    else if (key === 't') { teclas['t'] = true; if (meuEstado.upgrades?.orbitalMarker > 0 && meuEstado.orbitalMarkerCooldown <= 0 && nave.podeAtirarOrbital) activateOrbitalMarker(); } 
    else if (key === 'e') { teclas['e'] = true; if (meuEstado.upgrades?.batteryCannons > 0) activateBatteryCannons(); }

    else if (key in teclas) { teclas[key] = true; }

    else if (key >= '1' && key <= '8') {
        const index = parseInt(key) - 1;
        const buttons = [btnSendEnemy, btnSendShooter, btnSendBomber, btnSendInhibitor, btnSendMines, btnSendHunter, btnSendDisruptor, btnSendSpectral];
        if (buttons[index] && !buttons[index].disabled) {
            buttons[index].click();
        }
    }
});
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['shift', 'r', 'c', 'b', 'x', 'v', 't', 'e'].includes(key)) { teclas[key] = false; } 
    else if (key in teclas) { teclas[key] = false; }
});
canvas.addEventListener('mousemove', (e) => { const rect = canvas.getBoundingClientRect(); mousePos.x = e.clientX - rect.left; mousePos.y = e.clientY - rect.top; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) teclas[" "] = true; if (e.button === 2) { rightMouseDown = true; if (meuEstado.upgrades?.hyperspaceJump > 0 && meuEstado.hyperspaceCooldown <= 0) activateHyperspaceJump(); } });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) teclas[" "] = false; if (e.button === 2) rightMouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
botaoReiniciar.addEventListener('click', () => { modal.style.display = 'none'; window.location.reload(); });

function iniciarJogoMultiplayer() {
    nave = criarNave(); asteroides = []; asteroidesNeutros = [];
    tirosInimigos = []; explosoes = []; lootContainers = []; minasEnviadas = [];
    secondaryLaserBeams = []; napalmAreas = []; activePowerups = { rapidFire: { active: false, duration: 0 }, instantShield: { active: false }, tempLife: { active: false, duration: 0 } };
    activeStasisField = null; merchantVisible = false; removeMerchantVisual(); orbitalMarkerTarget = null; batteryCannonCharges = 0;
    screenShake = 0; 
    criarAsteroidesIniciais(NUM_ASTEROIDES_INICIAL); gameRunning = true;
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(update, 1000 / FPS);

    canvas.style.cursor = 'none';

    playerHudContainer.style.display = 'block';
}

function update() {
    if (!gameRunning || !meuEstado || !nave) return;

    if (sendEnemyCooldownTimer > 0) sendEnemyCooldownTimer -= deltaTime;
    neutralAsteroidSpawnTimer -= deltaTime; if (neutralAsteroidSpawnTimer <= 0) { spawnNeutralAsteroid(); neutralAsteroidSpawnTimer = 15.0; }

    for (const key in activePowerups) { if (activePowerups[key].active && activePowerups[key].duration > 0) { activePowerups[key].duration -= deltaTime; if (activePowerups[key].duration <= 0) { activePowerups[key].active = false; if (key === 'tempLife' && meuEstado.vidas > (3 + (meuEstado.upgrades?.resistencia || 0))) { meuEstado.vidas--; playerVidasEl.textContent = meuEstado.vidas; } } } }

    if (activeStasisField && Date.now() > activeStasisField.endTime) { activeStasisField = null; }

    if (orbitalMarkerTarget && Date.now() >= orbitalMarkerTarget.endTime) {
         criarOrbitalStrike(orbitalMarkerTarget.x);
         orbitalMarkerTarget = null;
    }

    if (nave.energyReconfigActive && Date.now() >= nave.energyReconfigEnd) {
         nave.energyReconfigActive = false;

    }

    frameCount++;
    atualizarBotoesAcao(); processInput(); moverNave(); atualizarAlvosMisseis();
    moverLasers(); moverAsteroides(); moverAsteroidesNeutros(); moverTirosInimigos(); moverLootContainers(); moverMinas(); moverNapalm();
    detectarColisoes(); desenhar();

    if (frameCount % 90 === 0) enviarSnapshot(); 

}

function desenhar() {

    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake * 0.5;
        const dy = (Math.random() - 0.5) * screenShake * 0.5;
        ctx.translate(dx, dy);
        screenShake *= 0.9; 
        if (screenShake < 0.5) screenShake = 0;
    }

    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    desenharStasisField();
    desenharNave();
    if (isLaserActive) { desenharLaserBeam(); desenharFeixesSecundarios(); }
    desenharNapalm();
    desenharAsteroides(); desenharAsteroidesNeutros(); desenharLasers();
    desenharTirosInimigos(); desenharExplosoes(); desenharLootContainers(); desenharMinas();
    desenharOrbitalMarker();

    ctx.restore();

    if (gameRunning) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 8, 0, Math.PI * 2); 
        ctx.moveTo(mousePos.x - 12, mousePos.y);
        ctx.lineTo(mousePos.x + 12, mousePos.y); 
        ctx.moveTo(mousePos.x, mousePos.y - 12);
        ctx.lineTo(mousePos.x, mousePos.y + 12); 
        ctx.stroke();
    }

    if (gameRunning && meuEstado && nave) {
        const vidaMaximaBase = 3 + (meuEstado.upgrades?.resistencia || 0);
        const vidaAtual = meuEstado.vidas;
        const vidaPercent = Math.max(0, Math.min(100, (vidaAtual / vidaMaximaBase) * 100));
        playerHudVida.style.width = `${vidaPercent}%`;

        const escudoMaximo = meuEstado.upgrades?.escudo || 0;
        const escudoAtual = nave.escudoAtual || 0;
        const escudoPercent = (escudoMaximo > 0) ? Math.max(0, Math.min(100, (escudoAtual / escudoMaximo) * 100)) : 0;
        playerHudEscudo.style.width = `${escudoPercent}%`;

        playerHudEscudo.parentElement.style.display = (escudoMaximo > 0) ? 'block' : 'none';
    }

}

function enviarSnapshot() { try { const snapshot = canvas.toDataURL('image/jpeg', 0.4); socket.emit('sendSnapshot', { roomId: minhaRoomId, snapshot: snapshot }); } catch (e) { console.error("Erro ao criar snapshot:", e); } }

function atualizarBotoesAcao() {
    if (!meuEstado || !meuEstado.upgrades) return;
    const custoAsteroide = 50, custoAtirador = 250, custoBomba = 400, custoInibidor = 350, custoMinas = 200, custoHunter = 650, custoDisruptor = 600, custoSpectral = 500;
    const dinheiro = meuEstado.dinheiro || 0;
    const hasBomberUpgrade = meuEstado.upgrades.bomberAsteroid > 0;
    const hasInhibitorUpgrade = meuEstado.upgrades.incomeInhibitor > 0;
    const hasMineUpgrade = meuEstado.upgrades.minefieldDeploy > 0;
    const hasHunterUpgrade = meuEstado.upgrades.hunterAsteroid > 0;
    const hasDisruptorUpgrade = meuEstado.upgrades.shieldDisruptor > 0;
    const hasSpectralUpgrade = meuEstado.upgrades.spectralShip > 0;
    const maxMinesReached = meuEstado.mineCount >= 6;

    if (sendEnemyCooldownTimer > 0) {
        const cd = sendEnemyCooldownTimer.toFixed(1);
        btnSendEnemy.disabled = true; btnSendEnemy.textContent = `Enviar Asteroide (1) (${cd}s)`;
        btnSendShooter.disabled = true; btnSendShooter.textContent = `Enviar Atirador (2) (${cd}s)`;
        btnSendBomber.disabled = true; btnSendBomber.textContent = `Enviar Bomba (3) (${cd}s)`;
        btnSendInhibitor.disabled = true; btnSendInhibitor.textContent = `Enviar Inibidor (4) (${cd}s)`;
        btnSendMines.disabled = true; btnSendMines.textContent = `Enviar Minas (5) (${cd}s)`;
        btnSendHunter.disabled = true; btnSendHunter.textContent = `Enviar Caçador (6) (${cd}s)`;
        btnSendDisruptor.disabled = true; btnSendDisruptor.textContent = `Enviar Disruptor (7) (${cd}s)`;
        btnSendSpectral.disabled = true; btnSendSpectral.textContent = `Enviar Espectral (8) (${cd}s)`;
    } else {
        btnSendEnemy.disabled = dinheiro < custoAsteroide; btnSendEnemy.textContent = `Enviar Asteroide (1) (Custo: ${custoAsteroide})`;
        btnSendShooter.disabled = dinheiro < custoAtirador; btnSendShooter.textContent = `Enviar Atirador (2) (Custo: ${custoAtirador})`;
        btnSendBomber.disabled = dinheiro < custoBomba || !hasBomberUpgrade; btnSendBomber.textContent = `Enviar Bomba (3) (Custo: ${custoBomba})`;
        btnSendInhibitor.disabled = dinheiro < custoInibidor || !hasInhibitorUpgrade; btnSendInhibitor.textContent = `Enviar Inibidor (4) (Custo: ${custoInibidor})`;
        btnSendMines.disabled = dinheiro < custoMinas || !hasMineUpgrade || maxMinesReached;
        let mineText = `Enviar Minas (5) (Custo: ${custoMinas})`; if (maxMinesReached) mineText += ` [MAX ${meuEstado.mineCount}/6]`; else if (hasMineUpgrade) mineText += ` [${meuEstado.mineCount}/6]`; btnSendMines.textContent = mineText;
        btnSendHunter.disabled = dinheiro < custoHunter || !hasHunterUpgrade; btnSendHunter.textContent = `Enviar Caçador (6) (Custo: ${custoHunter})`;
        btnSendDisruptor.disabled = dinheiro < custoDisruptor || !hasDisruptorUpgrade; btnSendDisruptor.textContent = `Enviar Disruptor (7) (Custo: ${custoDisruptor})`;
        btnSendSpectral.disabled = dinheiro < custoSpectral || !hasSpectralUpgrade; btnSendSpectral.textContent = `Enviar Espectral (8) (Custo: ${custoSpectral})`;
    }

}

function criarNave() { return { x: canvas.width / 2, y: canvas.height / 2, raio: TAMANHO_NAVE / 2, angulo: -Math.PI / 2, velocidade: { x: 0, y: 0 }, acelerando: false, invencivel: false, contadorInvencibilidade: 0, lasers: [], escudoAtual: 0, escudoRegenTimer: 5.0, podeAtirarNormal: true, podeAtirarMissil: true, podeAtirarHoming: true, podeAtirarOrbital: true, energyReconfigActive: false, energyReconfigEnd: 0, corrosionDuration: 0 }; } 
function criarNovoAsteroide(tamanho, x, y, options = {}) {
    const tipo = options.tipo || 'normal';
    if (x === undefined && y === undefined) {
        if (Math.random() < 0.5) {
            x = (Math.random() < 0.5 ? 0 - tamanho : canvas.width + tamanho);
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = (Math.random() < 0.5 ? 0 - tamanho : canvas.height + tamanho);
        }
    }
    let velocidade;
    if (options.overrideVelocity) {
        velocidade = options.overrideVelocity;
    } else {
        let angulo = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x);
        let vel = VELOCIDADE_ASTEROIDE * (Math.random() * 0.5 + 0.75);
        velocidade = { x: vel * Math.cos(angulo) / FPS, y: vel * Math.sin(angulo) / FPS };
    }
    if (['bomber', 'inhibitor', 'disruptor', 'spectral'].includes(tipo)) {
        velocidade.x *= 0.7;
        velocidade.y *= 0.7;
    }
    if (tipo === 'hunter') {
        velocidade.x *= 1.3;
        velocidade.y *= 1.3;
    }
    return {
        id: (tipo === 'inhibitor' || tipo === 'mine') ? options.id : null || Date.now() + Math.random(),
        x: x, y: y,
        raio: tamanho / 2,
        tamanho: tamanho,
        anguloVisual: (Math.random() * 360) / 180 * Math.PI,
        velocidade: velocidade,
        rotacao: (Math.random() * 180 - 90) / 180 * Math.PI / FPS,
        vertices: Math.floor(Math.random() * 5 + 8),
        vida: 1, vidaMaxima: 1,
        atira: false, cooldownTiro: 0, nivelAtirador: 0, bountyValue: 0,
        laserHitTimer: 0, cor: "white", tipo: tipo,
        bomberTimer: (tipo === 'bomber') ? 8.0 : null,
        inhibitorTimer: (tipo === 'inhibitor') ? 15.0 : null,
        slowEffectDuration: 0, originalSpeedMultiplier: 1.0,
        advancedTargeting: options.advancedTargeting || false,
        toxicShards: options.toxicShards || false,
        reinforcedHull: options.reinforcedHull || false,
        isInStasis: false, isHacked: false, hackerId: null,
        spectralTargetAngle: 0, disruptorReachedMid: false, corrosionDuration: 0,

        barrageShotCounter: 0, 
        barrageShotTimer: 0    

    };
}
function spawnNeutralAsteroid() { if (asteroidesNeutros.length > 5) return; let asteroide = criarNovoAsteroide(40, undefined, undefined, { tipo: 'neutral' }); asteroide.cor = "#FFFF00"; asteroide.vida = 20; asteroide.vidaMaxima = 20; asteroide.velocidade.x *= 0.5; asteroide.velocidade.y *= 0.5; asteroidesNeutros.push(asteroide); socket.emit('neutralAsteroidCreated', { roomId: minhaRoomId, asteroidId: asteroide.id, x: asteroide.x, y: asteroide.y }); }
function criarAsteroidesIniciais(num) { for (let i = 0; i < num; i++) asteroides.push(criarNovoAsteroide(TAMANHO_ASTEROIDE_BASE)); }
function criarEMPExplosao(x, y, radius) { explosoes.push({ x: x, y: y, raio: radius, vida: 15, vidaMax: 15, cor: "rgba(0, 180, 255, 0.7)" }); explosoes.push({ x: x, y: y, raio: radius * 1.2, vida: 20, vidaMax: 20, cor: "rgba(200, 220, 255, 0.3)" }); }
function criarLootContainer(x, y, amount, type = 'money', powerupType = null) { return { id: `loot_${Date.now()}_${Math.random()}`, x: x, y: y, amount: amount, timer: LOOT_DURATION, raio: 15, type: type, powerupType: powerupType }; }
function criarMina(x, y, data) { return { id: data.id, ownerId: data.ownerId, x: x, y: y, raio: 10, armTimer: MINE_ARM_TIME, armed: false, damage: data.damage, explosionRadius: data.radius, bounty: data.bountyValue, isInStasis: false, isStealth: data.isStealth }; }
function criarFeixeSecundario(origX, origY, anguloBase, hitAsteroide) { const angulo1 = anguloBase + PRISM_ANGLE; const angulo2 = anguloBase - PRISM_ANGLE; const comprimento = 500; secondaryLaserBeams.push({ startX: origX, startY: origY, endX: origX + comprimento * Math.cos(angulo1), endY: origY + comprimento * Math.sin(angulo1), angulo: angulo1, vida: FPS * 0.3, ignoreId: hitAsteroide.id }); secondaryLaserBeams.push({ startX: origX, startY: origY, endX: origX + comprimento * Math.cos(angulo2), endY: origY + comprimento * Math.sin(angulo2), angulo: angulo2, vida: FPS * 0.3, ignoreId: hitAsteroide.id }); }
function criarSaltoVisual(x, y) { explosoes.push({ x: x, y: y, raio: nave.raio * 2, vida: 10, vidaMax: 10, cor: "rgba(200, 200, 255, 0.8)" }); }
function criarNapalmArea(x, y, radius) { napalmAreas.push({ x: x, y: y, radius: radius, duration: NAPALM_DURATION, intensity: 1.0 }); }
function criarOrbitalStrike(targetX) { const startY = -50; const endY = canvas.height + 50; explosoes.push({ x: targetX, y: startY, targetY: endY, raio: ORBITAL_STRIKE_RADIUS, vida: FPS * 0.5, vidaMax: FPS * 0.5, cor: "red", type: 'orbitalBeam' }); const allTargets = [...asteroides, ...asteroidesNeutros, nave]; for (const target of allTargets) { if (Math.abs(target.x - targetX) < (target.raio || 0) + ORBITAL_STRIKE_RADIUS) { if (target === nave) { if (!nave.invencivel) { if (nave.escudoAtual > 0) nave.escudoAtual = 0; else { socket.emit('playerHit', minhaRoomId); reiniciarNaveAposHit(); } } } else { target.vida -= ORBITAL_STRIKE_DAMAGE; if (target.vida <= 0) { if (asteroides.includes(target)) destruirAsteroide(asteroides.indexOf(target)); else if (asteroidesNeutros.includes(target)) { const id = target.id; explosoes.push({ x: target.x, y: target.y, raio: target.raio, vida: 10, vidaMax: 10, cor: target.cor }); asteroidesNeutros.splice(asteroidesNeutros.indexOf(target), 1); socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: target.x, y: target.y }); } } } } } }
function criarSingularity(x, y, angle) { const speed = 150; nave.lasers.push({ x: x, y: y, distancia: 0, dano: 0, eMissil: false, eHoming: false, eCluster: false, eSingularity: true, angulo: angle, speed: speed, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, pierceCount: 0, singularityState: 'traveling', singularityTimer: 3.0 }); }
function criarBatteryCannonShot(x, y, angle, charges) { const speed = 700; const damage = 10 + charges * 5; nave.lasers.push({ x: x, y: y, distancia: 0, dano: damage, eMissil: false, eHoming: false, eCluster: false, eBattery: true, angulo: angle, speed: speed, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, pierceCount: 1 + charges }); }
function criarRicochetMicroMissile(x, y, angle) { const speed = 500; nave.lasers.push({ x: x, y: y, distancia: 0, dano: 0.5, eMissil: false, eHoming: false, eCluster: false, eMicroMissile: true, angulo: angle, speed: speed, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, pierceCount: 0, bouncesLeft: 1 }); }
function criarShrapnel(x, y) { const speed = 300; for (let i = 0; i < 3; i++) { const angle = Math.random() * Math.PI * 2; nave.lasers.push({ x: x, y: y, distancia: 0, dano: 0.25, eMissil: false, eHoming: false, eCluster: false, eShrapnel: true, angulo: angle, speed: speed, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, pierceCount: 0 }); } }
function criarToxicShardShot(x, y, angle) { const speed = 200; tirosInimigos.push({ x: x, y: y, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, raio: 4, isToxic: true }); }
function criarSpectralShot(x, y, angle) { const speed = 150; tirosInimigos.push({ x: x, y: y, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, raio: 5, isSpectral: true }); }

function desenharNave() {
    if (!nave) return;
    if (nave.invencivel && Math.floor(nave.contadorInvencibilidade / 5) % 2 === 0) return;
    const upgrades = meuEstado.upgrades || {};
    ctx.save();
    ctx.translate(nave.x, nave.y);
    ctx.rotate(nave.angulo);
    if (nave.energyReconfigActive) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "yellow";
    }
    if (nave.corrosionDuration > 0) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = "lime";
    } 

    ctx.strokeStyle = "white";
    ctx.lineWidth = TAMANHO_NAVE / 15;
    ctx.beginPath();
    ctx.moveTo(nave.raio * 4 / 3, 0); 
    ctx.lineTo(-nave.raio * 2 / 3, -nave.raio); 
    ctx.lineTo(-nave.raio * 2 / 3, nave.raio); 
    ctx.closePath();
    ctx.stroke(); 

    if (upgrades.ultimate_cluster > 0) {
        ctx.fillStyle = "white"; ctx.strokeStyle = "red"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.rect(-nave.raio * 0.3, -nave.raio * 0.4, nave.raio, nave.raio * 0.8); ctx.fill(); ctx.stroke();
    } else if (upgrades.tiroDuplo > 0) {
        ctx.fillStyle = "grey"; ctx.fillRect(0, -nave.raio * 0.7, nave.raio * 0.5, nave.raio * 0.2);
        ctx.fillRect(0, nave.raio * 0.5, nave.raio * 0.5, nave.raio * 0.2);
    }
    if (upgrades.ultimate_laser > 0) {
        ctx.fillStyle = "white"; ctx.beginPath(); ctx.moveTo(nave.raio * 1.5, 0);
        ctx.lineTo(nave.raio * 0.8, -nave.raio * 0.4); ctx.lineTo(nave.raio * 0.8, nave.raio * 0.4); ctx.closePath(); ctx.fill();
    } else if (upgrades.laser > 0) {
        ctx.fillStyle = "red"; ctx.beginPath(); ctx.moveTo(nave.raio * 4 / 3, 0);
        ctx.lineTo(nave.raio * 0.8, -nave.raio * 0.2); ctx.lineTo(nave.raio * 0.8, nave.raio * 0.2); ctx.closePath(); ctx.fill();
    }
    if (upgrades.ultimate_barrage > 0) {
        ctx.fillStyle = "#FF8C00"; ctx.fillRect(-nave.raio * 0.5, -nave.raio * 0.9, nave.raio * 0.7, nave.raio * 0.3);
        ctx.fillRect(-nave.raio * 0.5, nave.raio * 0.6, nave.raio * 0.7, nave.raio * 0.3);
    } else if (upgrades.missil > 0) {
        ctx.fillStyle = "#FF8C00"; ctx.fillRect(-nave.raio * 0.2, -nave.raio * 0.2, nave.raio * 0.5, nave.raio * 0.4);
    }
    if (upgrades.ultimate_swarm > 0) {
        ctx.fillStyle = "cyan"; ctx.fillRect(-nave.raio * 0.8, -nave.raio * 0.4, nave.raio * 0.3, nave.raio * 0.8);
        ctx.fillStyle = "red"; ctx.fillRect(-nave.raio * 0.75, -nave.raio * 0.3, nave.raio * 0.2, nave.raio * 0.1);
        ctx.fillRect(-nave.raio * 0.75, 0, nave.raio * 0.2, nave.raio * 0.1);
        ctx.fillRect(-nave.raio * 0.75, nave.raio * 0.2, nave.raio * 0.2, nave.raio * 0.1);
    } else if (upgrades.homingMissile > 0) {
        ctx.strokeStyle = "cyan"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-nave.raio * 0.5, 0);
        ctx.lineTo(-nave.raio * 0.8, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(-nave.raio * 0.8, 0, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (upgrades.cryoAmmo > 0) {
        ctx.fillStyle = "#ADD8E6"; ctx.fillRect(nave.raio * 0.5, -nave.raio * 0.15, nave.raio * 0.6, nave.raio * 0.3);
    }
    if (upgrades.matterConverter > 0) {
        ctx.fillStyle = "#00FF00"; ctx.beginPath(); ctx.arc(-nave.raio, 0, nave.raio * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (upgrades.ultimate_shield > 0) {
        ctx.strokeStyle = "cyan"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-nave.raio * 0.7, -nave.raio * 1.1);
        ctx.lineTo(-nave.raio * 0.9, -nave.raio * 1.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-nave.raio * 0.7, nave.raio * 1.1);
        ctx.lineTo(-nave.raio * 0.9, nave.raio * 1.3); ctx.stroke();
    }
    if (upgrades.hyperspaceJump > 0) {
        ctx.fillStyle = "lightblue"; ctx.beginPath(); ctx.moveTo(-nave.raio * 0.8, -nave.raio * 0.7);
        ctx.lineTo(-nave.raio * 1.1, -nave.raio * 0.7); ctx.lineTo(-nave.raio * 0.8, -nave.raio * 0.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-nave.raio * 0.8, nave.raio * 0.7); ctx.lineTo(-nave.raio * 1.1, nave.raio * 0.7);
        ctx.lineTo(-nave.raio * 0.8, nave.raio * 0.4); ctx.closePath(); ctx.fill();
    }
    if (upgrades.repulsorField > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; ctx.lineWidth = 1; ctx.beginPath();
        ctx.arc(0, 0, nave.raio * 3, 0, Math.PI * 2); ctx.stroke();
    }
    if (upgrades.stasisField > 0) {
        ctx.fillStyle = activeStasisField && activeStasisField.ownerId === meuSocketId ? "rgba(100, 100, 255, 0.1)" : "transparent";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    }
    if (upgrades.batteryCannons > 0 && batteryCannonCharges > 0) {
        ctx.fillStyle = "yellow"; for (let i = 0; i < batteryCannonCharges; i++) ctx.fillRect(-nave.raio * 0.5 + i * 5, nave.raio * 0.8, 4, 4);
    }
    if (upgrades.orbitalMarker > 0) {
        ctx.strokeStyle = "red"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(nave.raio * 0.5, 0);
        ctx.lineTo(nave.raio * 0.8, -3); ctx.lineTo(nave.raio * 0.8, 3); ctx.closePath(); ctx.stroke();
    }

    if (nave.acelerando) {
        ctx.fillStyle = "red"; ctx.strokeStyle = "yellow"; ctx.lineWidth = TAMANHO_NAVE / 20;
        ctx.beginPath(); ctx.moveTo(-nave.raio * 2 / 3, -nave.raio * 0.5);
        ctx.lineTo(-nave.raio * 5 / 3, 0); ctx.lineTo(-nave.raio * 2 / 3, nave.raio * 0.5); ctx.closePath();
        ctx.fill(); ctx.stroke();
    }

    ctx.shadowBlur = 0; 
    ctx.restore(); 

    if (nave.escudoAtual > 0) {
        ctx.strokeStyle = "cyan";
        ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
        ctx.lineWidth = 1 + (nave.escudoAtual * 0.5);
        ctx.beginPath();

        ctx.arc(nave.x, nave.y, nave.raio + 5 + (nave.escudoAtual), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
    }

    if (gameRunning) { 

        ctx.strokeStyle = "rgba(0, 255, 0, 0.8)"; 
        ctx.lineWidth = 2; 
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 18, 0, Math.PI * 2); 
        ctx.stroke();

        ctx.fillStyle = "rgba(0, 255, 0, 1)"; 
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 3, 0, Math.PI * 2); 
        ctx.fill();
    }

}

function desenharLaserBeam() { if (!meuEstado.upgrades) return; const upgrades = meuEstado.upgrades; const angulo = nave.angulo; const pontaX = nave.x + 4/3 * nave.raio * Math.cos(angulo); const pontaY = nave.y + 4/3 * nave.raio * Math.sin(angulo); const endX = pontaX + 2000 * Math.cos(angulo); const endY = pontaY + 2000 * Math.sin(angulo); let widthMultiplier = (upgrades.laserAmplifier || 0) * 0.2 + 1.0; if (upgrades.ultimate_laser > 0) { ctx.strokeStyle = "white"; ctx.lineWidth = (10 + (Math.random() * 4)) * widthMultiplier; ctx.globalAlpha = 1.0; ctx.beginPath(); ctx.moveTo(pontaX, pontaY); ctx.lineTo(endX, endY); ctx.stroke(); ctx.strokeStyle = "fuchsia"; ctx.lineWidth = (2 + (Math.random() * 2)) * widthMultiplier; ctx.beginPath(); ctx.moveTo(pontaX, pontaY); ctx.lineTo(endX, endY); ctx.stroke(); } else { ctx.strokeStyle = "fuchsia"; ctx.lineWidth = (1 + upgrades.laser) * widthMultiplier; ctx.globalAlpha = 0.7 + (Math.random() * 0.3); ctx.beginPath(); ctx.moveTo(pontaX, pontaY); ctx.lineTo(endX, endY); ctx.stroke(); } ctx.globalAlpha = 1.0; }
function desenharAsteroides() {
    for (const a of asteroides) {
        let isSlowed = a.slowEffectDuration > 0 || a.isInStasis;
        ctx.save();

        if (a.laserHitTimer > 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; 
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
        } else {

            if (a.tipo === 'bomber') {
                const pulse = Math.abs(Math.sin(frameCount * 0.3));
                ctx.strokeStyle = `rgb(255, ${pulse * 100}, 0)`;
                ctx.lineWidth = 3 + pulse * 2;
            } else if (a.tipo === 'inhibitor') {
                ctx.strokeStyle = `rgba(150, 0, 255, ${0.5 + Math.abs(Math.sin(frameCount * 0.2)) * 0.5})`;
                ctx.lineWidth = 2;
            } else if (a.tipo === 'hunter') {
                ctx.strokeStyle = "orange";
                ctx.lineWidth = 2;
            } else if (a.tipo === 'disruptor') {
                ctx.strokeStyle = "purple";
                ctx.lineWidth = 2;
            } else if (a.tipo === 'spectral') {
                ctx.strokeStyle = `rgba(180, 180, 255, ${0.5 + Math.abs(Math.sin(frameCount*0.2))*0.3})`;
                ctx.lineWidth = 1;
                ctx.fillStyle = `rgba(180, 180, 255, 0.1)`;
            } else {
                ctx.strokeStyle = a.atira ? "yellow" : a.cor;
                ctx.lineWidth = TAMANHO_NAVE / 20;
                ctx.fillStyle = "transparent";
            }
        } 

        if (a.isHacked) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "purple";
        }
        if (a.corrosionDuration > 0 && a.laserHitTimer <= 0) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        }
        if (isSlowed && a.laserHitTimer <= 0) ctx.fillStyle = "rgba(0, 150, 255, 0.2)";
        ctx.beginPath();
        ctx.moveTo(a.x + a.raio * Math.cos(a.anguloVisual), a.y + a.raio * Math.sin(a.anguloVisual));
        for (let i = 1; i < a.vertices; i++) {
            const ang = a.anguloVisual + i * (2 * Math.PI / a.vertices);
            ctx.lineTo(a.x + a.raio * Math.cos(ang), a.y + a.raio * Math.sin(ang));
        }
        ctx.closePath();
        ctx.stroke();
        if (isSlowed || a.corrosionDuration > 0 || a.tipo === 'spectral' || a.laserHitTimer > 0) ctx.fill(); 

        ctx.shadowBlur = 0;

        if (a.vida < a.vidaMaxima) {
            const healthBarWidth = a.raio * 1.0; 
            const alturaBarra = 3; 
            const xBarra = a.x - healthBarWidth / 2;
            const yBarra = a.y - a.raio - 8; 

            ctx.fillStyle = "rgba(100, 0, 0, 0.7)";
            ctx.fillRect(xBarra, yBarra, healthBarWidth, alturaBarra);

            ctx.fillStyle = "rgba(0, 120, 0, 0.8)";
            ctx.fillRect(xBarra, yBarra, healthBarWidth * (a.vida / a.vidaMaxima), alturaBarra);
        }

        if (a.tipo === 'inhibitor' && a.inhibitorTimer !== null && a.inhibitorTimer > 0) {
            ctx.fillStyle = "white";
            ctx.font = "12px Courier New";
            ctx.textAlign = "center";
            ctx.fillText(a.inhibitorTimer.toFixed(1) + "s", a.x, a.y + a.raio + 15);
        }
        ctx.restore();
    }
}function desenharAsteroidesNeutros() {
    for (const a of asteroidesNeutros) {
        let isSlowed = a.slowEffectDuration > 0 || a.isInStasis;
        ctx.save();

        if (a.laserHitTimer > 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
        } else {

            ctx.strokeStyle = a.cor;
            ctx.lineWidth = TAMANHO_NAVE / 20;
            if (isSlowed) ctx.fillStyle = "rgba(0, 150, 255, 0.2)";
            else ctx.fillStyle = "transparent";
        } 

        ctx.beginPath();
        ctx.moveTo(a.x + a.raio * Math.cos(a.anguloVisual), a.y + a.raio * Math.sin(a.anguloVisual));
        for (let i = 1; i < a.vertices; i++) {
            const ang = a.anguloVisual + i * (2 * Math.PI / a.vertices);
            ctx.lineTo(a.x + a.raio * Math.cos(ang), a.y + a.raio * Math.sin(ang));
        }
        ctx.closePath();
        ctx.stroke();
        if (isSlowed || a.laserHitTimer > 0) ctx.fill(); 

        if (a.vida < a.vidaMaxima) {
            const healthBarWidth = a.raio * 1.0; 
            const alturaBarra = 3; 
            const xBarra = a.x - healthBarWidth / 2;
            const yBarra = a.y - a.raio - 8; 

            ctx.fillStyle = "rgba(100, 0, 0, 0.7)";
            ctx.fillRect(xBarra, yBarra, healthBarWidth, alturaBarra);

            ctx.fillStyle = "rgba(0, 120, 0, 0.8)";
            ctx.fillRect(xBarra, yBarra, healthBarWidth * (a.vida / a.vidaMaxima), alturaBarra);
        }

        ctx.restore();
    }
}function desenharLasers() { for (const laser of nave.lasers) { ctx.save(); ctx.translate(laser.x, laser.y); ctx.rotate(laser.angulo); let isCryo = meuEstado.upgrades?.cryoAmmo > 0 && !laser.eMissil && !laser.eCluster && !laser.eSingularity && !laser.eBattery && !laser.eMicroMissile && !laser.eShrapnel && !laser.eOrbitalMarker; if (laser.eCluster) { ctx.fillStyle = "red"; ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else if (laser.eHoming) { ctx.fillStyle = isCryo ? "#ADD8E6" : "#FF8C00"; if (isCryo) { ctx.shadowBlur = 5; ctx.shadowColor = "cyan"; } ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); } else if (laser.eMissil) { ctx.fillStyle = "#FF4500"; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); } else if (laser.eSingularity) { const pulse = 0.5 + Math.abs(Math.sin(frameCount * 0.4)) * 0.5; ctx.fillStyle = `rgba(150, 0, 255, ${pulse})`; ctx.shadowBlur = 15; ctx.shadowColor = "purple"; ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 4, 0, Math.PI * 2); ctx.fill(); } else if (laser.eBattery) { ctx.fillStyle = "yellow"; ctx.shadowBlur = 8; ctx.shadowColor = "orange"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill(); } else if (laser.eMicroMissile) { ctx.fillStyle = "#FFA500"; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, -2); ctx.lineTo(-2, 2); ctx.closePath(); ctx.fill(); } else if (laser.eShrapnel) { ctx.fillStyle = "grey"; ctx.beginPath(); ctx.arc(0,0, 2, 0, Math.PI*2); ctx.fill(); } else if (laser.eOrbitalMarker) { ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(0,0, 4, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle = isCryo ? "#ADD8E6" : "#00FF00"; if (isCryo) { ctx.shadowBlur = 5; ctx.shadowColor = "cyan"; } ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -2); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill(); } ctx.shadowBlur = 0; ctx.restore(); } }
function desenharTirosInimigos() { for (const tiro of tirosInimigos) { if (tiro.isToxic) { ctx.fillStyle = "lime"; } else if (tiro.isSpectral) { ctx.fillStyle = `rgba(180, 180, 255, ${0.5 + Math.abs(Math.sin(frameCount*0.3))*0.3})`; } else { ctx.fillStyle = "yellow"; } ctx.beginPath(); ctx.arc(tiro.x, tiro.y, tiro.raio, 0, Math.PI * 2); ctx.fill(); } }
function desenharExplosoes() {
    for (let i = explosoes.length - 1; i >= 0; i--) {
        const e = explosoes[i];
        if (e.type === 'orbitalBeam') {
            ctx.strokeStyle = e.cor;
            ctx.lineWidth = e.raio * (e.vida / e.vidaMax); 
            ctx.globalAlpha = (e.vida / e.vidaMax) * 0.8; 
            ctx.beginPath();
            ctx.moveTo(e.x, 0);
            ctx.lineTo(e.x, canvas.height);
            ctx.stroke();
        } else {
            ctx.fillStyle = e.cor || "orange";
            ctx.globalAlpha = e.vida / e.vidaMax; 
            ctx.beginPath();

            ctx.arc(e.x, e.y, e.raio, 0, Math.PI * 2); 

            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        e.vida--;
        if (e.vida <= 0) explosoes.splice(i, 1);
    }
}
function desenharLootContainers() { for (const loot of lootContainers) { ctx.save(); ctx.translate(loot.x, loot.y); if (loot.type === 'money') { ctx.fillStyle = "#FFFF00"; ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2; ctx.fillRect(-loot.raio * 0.7, -loot.raio * 0.7, loot.raio * 1.4, loot.raio * 1.4); ctx.strokeRect(-loot.raio * 0.7, -loot.raio * 0.7, loot.raio * 1.4, loot.raio * 1.4); ctx.fillStyle = "black"; ctx.font = "bold 15px Courier New"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 0, 1); } else if (loot.type === 'powerup') { ctx.fillStyle = "#FF00FF"; ctx.strokeStyle = "#FF88FF"; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * loot.raio, -Math.sin((18 + i * 72) * Math.PI / 180) * loot.raio); ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * loot.raio * 0.5, -Math.sin((54 + i * 72) * Math.PI / 180) * loot.raio * 0.5); } ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); } }
function desenharMinas() { const isStealth = meuEstado.upgrades?.ultimate_stealthMines > 0; for (const mina of minasEnviadas) { let alpha = 1.0; if (isStealth && mina.armed) { const dist = distanciaEntrePontos(nave.x, nave.y, mina.x, mina.y); if (dist > 80) alpha = 0.1; else if (dist > 50) alpha = 0.5; } if (alpha < 0.15 && isStealth) continue; ctx.save(); ctx.translate(mina.x, mina.y); ctx.globalAlpha = alpha; if (mina.armed) { const pulse = 0.7 + Math.abs(Math.sin(frameCount * 0.2)) * 0.3; ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`; ctx.strokeStyle = "red"; } else { ctx.fillStyle = "rgba(100, 100, 100, 0.5)"; ctx.strokeStyle = "grey"; } ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, mina.raio, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = (i / 6) * (Math.PI * 2); ctx.moveTo(0, 0); ctx.lineTo(mina.raio * 1.5 * Math.cos(ang), mina.raio * 1.5 * Math.sin(ang)); } ctx.stroke(); ctx.restore(); } }
function desenharFeixesSecundarios() { for (const beam of secondaryLaserBeams) { ctx.strokeStyle = "white"; ctx.lineWidth = 3 + (Math.random() * 2); ctx.globalAlpha = (beam.vida / (FPS * 0.3)) * 0.8; ctx.beginPath(); ctx.moveTo(beam.startX, beam.startY); ctx.lineTo(beam.endX, beam.endY); ctx.stroke(); } ctx.globalAlpha = 1.0; }
function desenharNapalm() { for (const area of napalmAreas) { const pulse = 0.5 + Math.abs(Math.sin(frameCount * 0.3 + area.x)) * 0.5; const grad = ctx.createRadialGradient(area.x, area.y, area.radius * 0.2, area.x, area.y, area.radius); grad.addColorStop(0, `rgba(255, ${100 + pulse * 100}, 0, ${0.6 * area.intensity * pulse})`); grad.addColorStop(1, `rgba(255, 0, 0, 0)`); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(area.x, area.y, area.radius, 0, Math.PI * 2); ctx.fill(); } }
function desenharStasisField() { if (activeStasisField) { let ownerPos = { x: canvas.width/2, y: canvas.height/2 }; if (activeStasisField.ownerId === meuSocketId && nave) ownerPos = { x: nave.x, y: nave.y }; const radius = 200; const remaining = (activeStasisField.endTime - Date.now()) / 1000; const alpha = Math.max(0, Math.min(1, remaining / STASIS_DURATION)) * 0.3; ctx.fillStyle = `rgba(100, 100, 255, ${alpha})`; ctx.strokeStyle = `rgba(200, 200, 255, ${alpha * 2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ownerPos.x, ownerPos.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } }
function desenharOrbitalMarker() { if (orbitalMarkerTarget) { const x = orbitalMarkerTarget.x; const remaining = (orbitalMarkerTarget.endTime - Date.now()) / 1000; const progress = 1 - Math.max(0, remaining / ORBITAL_STRIKE_DELAY); ctx.strokeStyle = "red"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + Math.abs(Math.sin(frameCount * 0.3)) * 0.5; const offset = (1 - progress) * 100; ctx.beginPath(); ctx.moveTo(x - offset, 0); ctx.lineTo(x - offset, canvas.height); ctx.moveTo(x + offset, 0); ctx.lineTo(x + offset, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.arc(x, orbitalMarkerTarget.y, 10 + progress * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1.0; } }

function processInput() { nave.acelerando = (teclas.w || teclas.ArrowUp); isLaserActive = teclas[" "] && meuEstado.upgrades?.laser > 0; if (teclas[" "]) atirar(); }
function activateHyperspaceJump() { const targetX = nave.x + HYPERSPACE_DISTANCE * Math.cos(nave.angulo); const targetY = nave.y + HYPERSPACE_DISTANCE * Math.sin(nave.angulo); socket.emit('activateHyperspaceJump', { roomId: minhaRoomId, targetX: targetX, targetY: targetY }); }
function activateMatterConverter() { socket.emit('activateMatterConverter', minhaRoomId); }
function activateShieldOverload() { if (nave.escudoAtual <= 0) return; socket.emit('activateShieldOverload', minhaRoomId); criarEMPExplosao(nave.x, nave.y, EMP_RADIUS); nave.escudoAtual = 0; nave.escudoRegenTimer = 5.0; }
function activateStasisField() { socket.emit('activateStasisField', minhaRoomId); }
function activateMerchantCall() { socket.emit('activateMerchantCall', minhaRoomId); }
function activateEnergyReconfig() { socket.emit('activateEnergyReconfig', minhaRoomId); }
function activateRewardHack() { let closestEnemyAst = null; let minDist = REWARD_HACK_RANGE; for (const ast of asteroides) { if (['normal', 'shooter', 'bomber', 'inhibitor', 'hunter', 'disruptor', 'spectral'].includes(ast.tipo) && !ast.isHacked) { const dist = distanciaEntrePontos(nave.x, nave.y, ast.x, ast.y); const angleToAst = Math.atan2(ast.y - nave.y, ast.x - nave.x); const angleDiff = Math.abs(anguloNormalizado(angleToAst - nave.angulo)); if (dist < minDist && angleDiff < Math.PI / 4) { minDist = dist; closestEnemyAst = ast; } } } if (closestEnemyAst) { socket.emit('activateRewardHack', { roomId: minhaRoomId, targetId: closestEnemyAst.id }); explosoes.push({x: nave.x, y: nave.y, raio: REWARD_HACK_RANGE, vida: 10, vidaMax: 10, cor: "purple"}); } }
function activateOrbitalMarker() { const speed = 600; const angle = nave.angulo; const startX = nave.x + 4/3 * nave.raio * Math.cos(angle); const startY = nave.y + 4/3 * nave.raio * Math.sin(angle); nave.lasers.push({ x: startX, y: startY, distancia: 0, dano: 0, eMissil: false, eHoming: false, eCluster: false, eOrbitalMarker: true, angulo: angle, speed: speed, velocidade: { x: speed * Math.cos(angle) / FPS, y: speed * Math.sin(angle) / FPS }, pierceCount: 0 });
    nave.podeAtirarOrbital = false; 
    socket.emit('startOrbitalCooldown', minhaRoomId); 
    setTimeout(() => { nave.podeAtirarOrbital = true; }, 45000); 
}
function activateBatteryCannons() { if (batteryCannonCharges > 0) { const angle = nave.angulo; const startX = nave.x + 4/3 * nave.raio * Math.cos(angle); const startY = nave.y + 4/3 * nave.raio * Math.sin(angle); criarBatteryCannonShot(startX, startY, angle, batteryCannonCharges); batteryCannonCharges = 0; batteryChargesEl.textContent = batteryCannonCharges; } }
function activatePowerupEffect(type) { if (type === 'rapidFire') { activePowerups.rapidFire.active = true; activePowerups.rapidFire.duration = POWERUP_DURATION.rapidFire; } else if (type === 'instantShield') { if (meuEstado.upgrades?.escudo > 0) { nave.escudoAtual = meuEstado.upgrades.escudo; nave.escudoRegenTimer = 5.0; } } else if (type === 'tempLife') { if (!activePowerups.tempLife.active) { activePowerups.tempLife.active = true; activePowerups.tempLife.duration = POWERUP_DURATION.tempLife; meuEstado.vidas++; playerVidasEl.textContent = meuEstado.vidas; } else { activePowerups.tempLife.duration = POWERUP_DURATION.tempLife; } } }
function activateStasisEffect(ownerId) { activeStasisField = { ownerId: ownerId, endTime: Date.now() + STASIS_DURATION * 1000 }; explosoes.push({ x: nave.x, y: nave.y, raio: 200, vida: 15, vidaMax: 15, cor: "rgba(150, 150, 255, 0.5)" }); } 
function moverNave() { if(!nave) return; let selfSpeedMultiplier = 1.0; if (activeStasisField) { let stasisOwnerX = canvas.width / 2, stasisOwnerY = canvas.height / 2; if (activeStasisField.ownerId === meuSocketId) { stasisOwnerX = nave.x; stasisOwnerY = nave.y; } if (distanciaEntrePontos(nave.x, nave.y, stasisOwnerX, stasisOwnerY) < 200) { selfSpeedMultiplier = (activeStasisField.ownerId === meuSocketId) ? STASIS_SELF_SLOW : STASIS_SLOW_FACTOR; } } if(meuEstado.upgrades?.energyReconfig > 0 && nave.energyReconfigActive) selfSpeedMultiplier *= 1.3;
    nave.angulo = Math.atan2(mousePos.y - nave.y, mousePos.x - nave.x); if (nave.acelerando) { const a = ACELERACAO_NAVE*(1+(meuEstado.upgrades?.velocidade||0)*0.25); nave.velocidade.x += a*Math.cos(nave.angulo)/FPS; nave.velocidade.y += a*Math.sin(nave.angulo)/FPS; } else { nave.velocidade.x *= 1 - (ATRITO / FPS); nave.velocidade.y *= 1 - (ATRITO / FPS); } const maxS = 7.0*(1+(meuEstado.upgrades?.velocidade||0)*0.2); const curS = Math.sqrt(nave.velocidade.x**2 + nave.velocidade.y**2); if (curS > maxS) { nave.velocidade.x *= (maxS / curS); nave.velocidade.y *= (maxS / curS); } nave.x += nave.velocidade.x * selfSpeedMultiplier; nave.y += nave.velocidade.y * selfSpeedMultiplier; if (meuEstado.upgrades?.repulsorField > 0) { const RANGE = nave.raio * 3, FORCE = 0.5; const allAst = [...asteroides, ...asteroidesNeutros]; for (const ast of allAst) { if (ast.tamanho <= 25) { const dist = distanciaEntrePontos(nave.x, nave.y, ast.x, ast.y); if (dist < RANGE && dist > 0) { const angle = Math.atan2(ast.y - nave.y, ast.x - nave.x); const force = FORCE * (1 - dist / RANGE); ast.velocidade.x += Math.cos(angle) * force / FPS; ast.velocidade.y += Math.sin(angle) * force / FPS; } } } } if (nave.x < 0) nave.x = canvas.width; if (nave.x > canvas.width) nave.x = 0; if (nave.y < 0) nave.y = canvas.height; if (nave.y > canvas.height) nave.y = 0; if (nave.invencivel) { nave.contadorInvencibilidade--; if (nave.contadorInvencibilidade <= 0) nave.invencivel = false; } if (meuEstado.upgrades?.escudo > 0 && nave.escudoAtual < meuEstado.upgrades.escudo && (meuEstado.shieldOverloadCooldown === undefined || meuEstado.shieldOverloadCooldown <= 0) && !(meuEstado.upgrades?.energyReconfig > 0 && nave.energyReconfigActive)) { nave.escudoRegenTimer -= deltaTime; if (nave.escudoRegenTimer <= 0) { nave.escudoAtual++; nave.escudoRegenTimer = 5.0; } }

    if (nave.corrosionDuration > 0) { nave.corrosionDuration -= deltaTime;  }
}
function moverLasers() { for (let i = nave.lasers.length - 1; i >= 0; i--) { const l = nave.lasers[i]; let speedMultiplier = 1.0; l.isInStasis = false; if (activeStasisField) { let sX=canvas.width/2, sY=canvas.height/2; if(activeStasisField.ownerId===meuSocketId){sX=nave.x; sY=nave.y;} if (distanciaEntrePontos(l.x, l.y, sX, sY) < 200) { speedMultiplier = STASIS_SLOW_FACTOR; l.isInStasis = true; } } if (l.eHoming && l.alvo) { if (!asteroideExiste(l.alvo.id)) l.alvo = encontrarAlvoMaisProximo(l); if (l.alvo) { const TURN = (meuEstado.upgrades?.targetingComputer||0)*0.01 + 0.08; let aA = Math.atan2(l.alvo.y - l.y, l.alvo.x - l.x); let diff = anguloNormalizado(aA - l.angulo); l.angulo += Math.sign(diff) * Math.min(Math.abs(diff), TURN); l.velocidade.x = (l.speed / FPS) * Math.cos(l.angulo); l.velocidade.y = (l.speed / FPS) * Math.sin(l.angulo); } } if(l.eSingularity) { if(l.singularityState === 'traveling') { if(l.distancia > 250) { l.singularityState = 'pulling'; l.velocidade.x = 0; l.velocidade.y = 0; } } else if (l.singularityState === 'pulling') { l.singularityTimer -= deltaTime; if(l.singularityTimer <= 0) { l.singularityState = 'imploding'; explosoes.push({x:l.x, y:l.y, raio: SINGULARITY_IMPLOSION_RADIUS, vida:15, vidaMax:15, cor:"purple"}); aplicarDanoEmArea(l.x, l.y, SINGULARITY_IMPLOSION_RADIUS, -1); nave.lasers.splice(i,1); continue; } const PULL_FORCE = 0.5; const PULL_RADIUS = SINGULARITY_PULL_RADIUS; const allTargets = [...asteroides, ...asteroidesNeutros, ...tirosInimigos]; for(const target of allTargets) { if(target.tamanho <= 50 || target.raio <= 5) { const dist = distanciaEntrePontos(l.x, l.y, target.x, target.y); if(dist < PULL_RADIUS && dist > 10) { const angle = Math.atan2(l.y - target.y, l.x - target.x); const force = PULL_FORCE * (1 - dist/PULL_RADIUS); target.velocidade.x += Math.cos(angle) * force / FPS; target.velocidade.y += Math.sin(angle) * force / FPS; } } } } } if (l.eMicroMissile) { if (l.bouncesLeft > 0 && (l.x < l.raio || l.x > canvas.width - l.raio)) { l.velocidade.x *= -1; l.angulo = Math.atan2(l.velocidade.y, l.velocidade.x); l.bouncesLeft--; } if (l.bouncesLeft > 0 && (l.y < l.raio || l.y > canvas.height - l.raio)) { l.velocidade.y *= -1; l.angulo = Math.atan2(l.velocidade.y, l.velocidade.x); l.bouncesLeft--; } }
    l.x += l.velocidade.x * speedMultiplier; l.y += l.velocidade.y * speedMultiplier; l.distancia += Math.sqrt(l.velocidade.x**2 + l.velocidade.y**2) * speedMultiplier; const dMax = canvas.width * DURACAO_LASER; if (l.eCluster && l.distancia > 200) { explodirCluster(l.x, l.y, l); nave.lasers.splice(i, 1); continue; } if (l.distancia > dMax || l.x < -10 || l.x > canvas.width+10 || l.y < -10 || l.y > canvas.height+10) { nave.lasers.splice(i, 1); } } }
function moverAsteroides() {
    for (let i = asteroides.length - 1; i >= 0; i--) {
        const a = asteroides[i];
        let stasisMultiplier = 1.0;
        a.isInStasis = false;
        if (activeStasisField) {
            let sX = canvas.width / 2, sY = canvas.height / 2;
            if (activeStasisField.ownerId === meuSocketId && nave) { sX = nave.x; sY = nave.y; }
            if (distanciaEntrePontos(a.x, a.y, sX, sY) < 200) {
                stasisMultiplier = STASIS_SLOW_FACTOR;
                a.isInStasis = true;
            }
        }
        let cryoMultiplier = 1.0;
        if (a.slowEffectDuration > 0) {
            a.slowEffectDuration -= deltaTime;
            cryoMultiplier = CRYO_SLOW_FACTOR;
        }
        const speedMultiplier = stasisMultiplier * cryoMultiplier;
        if (a.tipo === 'hunter' && nave) {
            const angleToNave = Math.atan2(nave.y - a.y, nave.x - a.x);
            const speed = VELOCIDADE_ASTEROIDE * 1.3 / FPS;
            a.velocidade.x = Math.cos(angleToNave) * speed;
            a.velocidade.y = Math.sin(angleToNave) * speed;
        }
        if (a.tipo === 'disruptor' && !a.disruptorReachedMid) {
            if ((a.velocidade.y > 0 && a.y >= canvas.height / 2) || (a.velocidade.y < 0 && a.y <= canvas.height / 2)) {
                a.velocidade.x = 0;
                a.velocidade.y = 0;
                a.disruptorReachedMid = true;

                explosoes.push({ x: a.x, y: a.y, raio: 50, vida: 10, vidaMax: 10, cor: "purple" });
                asteroides.splice(i, 1);
                continue;
            }
        }
        a.x += a.velocidade.x * speedMultiplier;
        a.y += a.velocidade.y * speedMultiplier;
        a.anguloVisual += a.rotacao * speedMultiplier;
        if (a.laserHitTimer > 0) a.laserHitTimer -= deltaTime;
        if (a.corrosionDuration > 0) {
            a.corrosionDuration -= deltaTime;
            a.vida -= TOXIC_SHARD_DAMAGE * deltaTime * 30; 
            if (a.vida <= 0 && i < asteroides.length && asteroides[i] === a) destruirAsteroide(i);
        }
        if (a.tipo === 'bomber') {
            a.bomberTimer -= deltaTime;
            if (a.bomberTimer <= 0) {
                detonarBomba(a);
                asteroides.splice(i, 1);
                continue;
            }
        } else if (a.tipo === 'inhibitor') {
            if (a.inhibitorTimer !== null) a.inhibitorTimer -= deltaTime;
        }
        if (a.x < -a.raio) a.x = canvas.width + a.raio;
        if (a.x > canvas.width + a.raio) a.x = -a.raio;
        if (a.y < -a.raio) a.y = canvas.height + a.raio;
        if (a.y > canvas.height + a.raio) a.y = -a.raio;

        if (a.atira && nave && meuEstado.upgrades) { 
            a.cooldownTiro -= deltaTime * speedMultiplier;

            const isBarrage = meuEstado.upgrades.ultimate_barrageCoord > 0;
            const numShotsInBarrage = isBarrage ? 3 : 1;
            const delayBetweenShots = isBarrage ? 0.1 : 0; 

            if (a.barrageShotCounter > 0 && a.barrageShotCounter < numShotsInBarrage) {
                a.barrageShotTimer -= deltaTime * speedMultiplier;
                if (a.barrageShotTimer <= 0) {
                    const angulo = Math.atan2(nave.y - a.y, nave.x - a.x);
                    let velTiro = a.nivelAtirador === 2 ? 300 : 200;
                    if (a.advancedTargeting) velTiro *= 1.3;

                    if (a.tipo === 'spectral') criarSpectralShot(a.x, a.y, angulo);
                    else tirosInimigos.push({ x: a.x, y: a.y, velocidade: { x: velTiro * Math.cos(angulo) / FPS, y: velTiro * Math.sin(angulo) / FPS }, raio: 3 });

                    a.barrageShotCounter++;
                    a.barrageShotTimer = delayBetweenShots; 
                }
            }

            else if (a.cooldownTiro <= 0) {
                const angulo = Math.atan2(nave.y - a.y, nave.x - a.x);
                let velTiro = a.nivelAtirador === 2 ? 300 : 200;
                if (a.advancedTargeting) velTiro *= 1.3;

                if (a.tipo === 'spectral') criarSpectralShot(a.x, a.y, angulo);
                else tirosInimigos.push({ x: a.x, y: a.y, velocidade: { x: velTiro * Math.cos(angulo) / FPS, y: velTiro * Math.sin(angulo) / FPS }, raio: 3 });

                a.barrageShotCounter = 1;
                a.barrageShotTimer = delayBetweenShots;

                a.cooldownTiro = (a.nivelAtirador === 2) ? 1.5 : 3.0;
                if (isBarrage) a.cooldownTiro *= 1.5; 
            }

            if (a.barrageShotCounter >= numShotsInBarrage) {
                a.barrageShotCounter = 0;
            }

        }
    }
}
function moverAsteroidesNeutros() { for (const a of asteroidesNeutros) { let stasisMultiplier = 1.0; a.isInStasis = false; if (activeStasisField) { let sX=canvas.width/2, sY=canvas.height/2; if(activeStasisField.ownerId === meuSocketId && nave){sX=nave.x; sY=nave.y;} if (distanciaEntrePontos(a.x, a.y, sX, sY) < 200) { stasisMultiplier = STASIS_SLOW_FACTOR; a.isInStasis = true; } } let cryoMultiplier = 1.0; if (a.slowEffectDuration > 0) { a.slowEffectDuration -= deltaTime; cryoMultiplier = CRYO_SLOW_FACTOR; } const speedMultiplier = stasisMultiplier * cryoMultiplier; a.x += a.velocidade.x * speedMultiplier; a.y += a.velocidade.y * speedMultiplier; a.anguloVisual += a.rotacao * speedMultiplier; if (a.laserHitTimer > 0) a.laserHitTimer -= deltaTime; if (a.x < -a.raio) a.x=canvas.width+a.raio; if (a.x > canvas.width+a.raio) a.x=-a.raio; if (a.y < -a.raio) a.y=canvas.height+a.raio; if (a.y > canvas.height+a.raio) a.y=-a.raio; } }
function moverTirosInimigos() { for (let i = tirosInimigos.length - 1; i >= 0; i--) { const tiro = tirosInimigos[i]; let speedMultiplier = 1.0; tiro.isInStasis = false; if (activeStasisField) { let sX=canvas.width/2, sY=canvas.height/2; if(activeStasisField.ownerId === meuSocketId && nave){sX=nave.x; sY=nave.y;} if (distanciaEntrePontos(tiro.x, tiro.y, sX, sY) < 200) { speedMultiplier = STASIS_SLOW_FACTOR; tiro.isInStasis = true; } } tiro.x += tiro.velocidade.x * speedMultiplier; tiro.y += tiro.velocidade.y * speedMultiplier; if (tiro.x < 0 || tiro.x > canvas.width || tiro.y < 0 || tiro.y > canvas.height) tirosInimigos.splice(i, 1); } }
function moverLootContainers() { const COLLECTOR_RANGE = 80; const COLLECTOR_SPEED = 3; for (let i = lootContainers.length - 1; i >= 0; i--) { const loot = lootContainers[i]; loot.timer -= deltaTime; if (loot.timer <= 0) { lootContainers.splice(i, 1); continue; } if(meuEstado.upgrades?.cargoCollector > 0 && nave) { const dist = distanciaEntrePontos(nave.x, nave.y, loot.x, loot.y); if(dist < COLLECTOR_RANGE) { const angle = Math.atan2(nave.y - loot.y, nave.x - loot.x); loot.x += Math.cos(angle) * COLLECTOR_SPEED; loot.y += Math.sin(angle) * COLLECTOR_SPEED; } } } }
function moverMinas() { for (const mina of minasEnviadas) { if (!mina.armed) { mina.armTimer -= deltaTime; if (mina.armTimer <= 0) mina.armed = true; } } }
function moverNapalm() { for (let i = napalmAreas.length - 1; i >= 0; i--) { const area = napalmAreas[i]; area.duration -= deltaTime; area.intensity = Math.max(0, area.duration / NAPALM_DURATION); if (area.duration <= 0) napalmAreas.splice(i, 1); } }

function encontrarAlvoMaisProximo(pontoReferencia) {
    let todosAsteroides = [...asteroides, ...asteroidesNeutros];
    if (todosAsteroides.length === 0) return null;
    let alvo = null;
    let menorDistancia = Infinity;
    for (const ast of todosAsteroides) {
        const dist = distanciaEntrePontos(pontoReferencia.x, pontoReferencia.y, ast.x, ast.y);
        if (dist < menorDistancia) {
            menorDistancia = dist;
            alvo = ast;
        }
    }
    return alvo;
}

function encontrarAlvosMaisProximos(origem, quantidade) {
    let todosAsteroides = [...asteroides, ...asteroidesNeutros];
    if (todosAsteroides.length === 0) return [];
    let asteroidesComDist = todosAsteroides.map(ast => ({
        alvo: ast,
        dist: distanciaEntrePontos(origem.x, origem.y, ast.x, ast.y)
    }));
    asteroidesComDist.sort((a, b) => a.dist - b.dist);
    let alvos = [];
    for (let i = 0; i < asteroidesComDist.length && alvos.length < quantidade; i++) {
        alvos.push(asteroidesComDist[i].alvo);
    }

    while (alvos.length < quantidade && alvos.length > 0) {
        alvos.push(alvos[0]);
    }
    return alvos;
}

function asteroideExiste(id) {
    if (!id) return false;
    return asteroides.some(a => a.id === id) || asteroidesNeutros.some(a => a.id === id);
}

function atualizarAlvosMisseis() {
    for (let laser of nave.lasers) {
        if (laser.eHoming) {

            if (!laser.alvo || !asteroideExiste(laser.alvo.id)) {
                laser.alvo = encontrarAlvoMaisProximo(laser);
            }
        }
    }
}

function atirar() {
    if (!meuEstado || !meuEstado.upgrades) return; 
    const upgrades = meuEstado.upgrades;
    const angulo = nave.angulo;
    const pontaX = nave.x + 4/3 * nave.raio * Math.cos(angulo);
    const pontaY = nave.y + 4/3 * nave.raio * Math.sin(angulo);
    const speedNormal = 500 * (1 + (upgrades.superchargeCore || 0) * 0.1); 
    const pierceCount = (upgrades.piercingShots > 0) ? 1 : 0;
    const damageMultiplier = 1 + (upgrades.superchargeCore || 0) * 0.05; 

    let fireRateMultiplier = activePowerups.rapidFire.active ? 1.5 : 1.0;

    if (nave.energyReconfigActive) {
        fireRateMultiplier *= 1.5; 
    }

    if (nave.podeAtirarNormal) {
        let cooldown = 400;
        const damageBase = 1 * damageMultiplier; 

        if (upgrades.ultimate_cluster > 0) {

            cooldown = 800;
            const speed = 350 * (1 + (upgrades.superchargeCore || 0) * 0.1); 
            nave.lasers.push({
                x: pontaX, y: pontaY, distancia: 0, dano: 10 * damageMultiplier, 
                eMissil: false, eHoming: false, eCluster: true,
                angulo: angulo, speed: speed,
                velocidade: { x: speed * Math.cos(angulo) / FPS, y: speed * Math.sin(angulo) / FPS },
                pierceCount: 1 
            });
        } else if (upgrades.tiroDuplo > 0) {

            cooldown = 400;
            const angEsq = angulo - 0.1; const angDir = angulo + 0.1;
            nave.lasers.push({
                x: pontaX, y: pontaY, distancia: 0, dano: damageBase,
                eMissil: false, eHoming: false, angulo: angEsq, speed: speedNormal,
                velocidade: { x: speedNormal * Math.cos(angEsq) / FPS, y: speedNormal * Math.sin(angEsq) / FPS }, pierceCount: pierceCount
            });
            nave.lasers.push({
                x: pontaX, y: pontaY, distancia: 0, dano: damageBase,
                eMissil: false, eHoming: false, angulo: angDir, speed: speedNormal,
                velocidade: { x: speedNormal * Math.cos(angDir) / FPS, y: speedNormal * Math.sin(angDir) / FPS }, pierceCount: pierceCount
            });
        } else {

            cooldown = 400;
            nave.lasers.push({
                x: pontaX, y: pontaY, distancia: 0, dano: damageBase,
                eMissil: false, eHoming: false, angulo: angulo, speed: speedNormal,
                velocidade: { x: speedNormal * Math.cos(angulo) / FPS, y: speedNormal * Math.sin(angulo) / FPS }, pierceCount: pierceCount
            });
        }
        nave.podeAtirarNormal = false;
        setTimeout(() => { nave.podeAtirarNormal = true; }, cooldown / fireRateMultiplier); 
    }

    if (upgrades.missil > 0 && nave.podeAtirarMissil) {
        const speed = ((upgrades.ultimate_barrage > 0) ? 600 : 400) * (1 + (upgrades.superchargeCore || 0) * 0.1); 
        const damage = 3 * damageMultiplier; 
        nave.lasers.push({
            x: pontaX, y: pontaY, distancia: 0, dano: damage,
            eMissil: true, eHoming: false, angulo: angulo, speed: speed,
            velocidade: { x: speed * Math.cos(angulo) / FPS, y: speed * Math.sin(angulo) / FPS }, pierceCount: 0
        });
        nave.podeAtirarMissil = false;
        let cooldown = (upgrades.ultimate_barrage > 0) ? 300 : (1000 / (1 + upgrades.missil));
        setTimeout(() => { nave.podeAtirarMissil = true; }, cooldown / fireRateMultiplier); 
    }

    if (upgrades.homingMissile > 0 && nave.podeAtirarHoming) {
        const speed = 450 * (1 + (upgrades.superchargeCore || 0) * 0.1); 
        const damage = 2 * damageMultiplier; 
        let cooldown = 800;

        if (upgrades.ultimate_singularity > 0) {

            cooldown = 2000; 
            criarSingularity(pontaX, pontaY, angulo);
        } else if (upgrades.ultimate_swarm > 0) {

            cooldown = 1000;
            const QTD_MISSEIS = 5;
            let alvos = encontrarAlvosMaisProximos(nave, QTD_MISSEIS);
            for (let i = 0; i < QTD_MISSEIS; i++) {
                let anguloTiro = angulo + (Math.random() - 0.5) * 0.3;
                let alvoParaEsteMissil = (alvos.length > i) ? alvos[i] : (alvos.length > 0 ? alvos[0] : null);
                nave.lasers.push({
                    x: pontaX, y: pontaY, distancia: 0, dano: damage,
                    eMissil: false, eHoming: true, angulo: anguloTiro, speed: speed,
                    velocidade: { x: speed * Math.cos(anguloTiro) / FPS, y: speed * Math.sin(anguloTiro) / FPS }, alvo: alvoParaEsteMissil, pierceCount: 0
                });
            }
        } else {

            cooldown = 800;
            nave.lasers.push({
                x: pontaX, y: pontaY, distancia: 0, dano: damage,
                eMissil: false, eHoming: true, angulo: angulo, speed: speed,
                velocidade: { x: speed * Math.cos(angulo) / FPS, y: speed * Math.sin(angulo) / FPS }, alvo: null, pierceCount: 0
            });
        }
        nave.podeAtirarHoming = false;
        setTimeout(() => { nave.podeAtirarHoming = true; }, cooldown / fireRateMultiplier); 
    }
}

function explodirCluster(x, y, clusterShot) {

    aplicarDanoEmArea(x, y, 50, -1); 

    const speed = 400 * (1 + (meuEstado.upgrades?.superchargeCore || 0) * 0.1); 
    const QTD_FRAGMENTOS = 12;
    const pierceCount = (meuEstado.upgrades?.piercingShots > 0) ? 1 : 0;
    const damage = 1 * (1 + (meuEstado.upgrades?.superchargeCore || 0) * 0.05); 
    for (let i = 0; i < QTD_FRAGMENTOS; i++) {
        let anguloTiro = (i / QTD_FRAGMENTOS) * (Math.PI * 2);
        nave.lasers.push({
            x: x, y: y, distancia: 0, dano: damage,
            eMissil: false, eHoming: false, eCluster: false, eShrapnel: true, 
            angulo: anguloTiro, speed: speed,
            velocidade: { x: speed * Math.cos(anguloTiro) / FPS, y: speed * Math.sin(anguloTiro) / FPS },
            pierceCount: pierceCount
        });
    }
}

function detonarBomba(asteroide) {
    aplicarDanoEmArea(asteroide.x, asteroide.y, 100, -1); 

    screenShake = 10;
    const velTiro = 250;
    const useToxic = asteroide.toxicShards; 
    for (let i = 0; i < 4; i++) {
        const angulo = (i / 4) * (Math.PI * 2);
        if(useToxic) {
            criarToxicShardShot(asteroide.x, asteroide.y, angulo);
        } else {
            tirosInimigos.push({ x: asteroide.x, y: asteroide.y, velocidade: { x: velTiro * Math.cos(angulo) / FPS, y: velTiro * Math.sin(angulo) / FPS }, raio: 3, isToxic: false, isSpectral: false });
        }
    }
}

function destruirAsteroide(index, hitVelocity = {x: 0, y: 0}) {

    if (index < 0 || index >= asteroides.length) {
        console.warn("Tentativa de destruir asteroide com índice inválido:", index);
        return;
    }
    const a = asteroides[index];
    if (!a) { 
        console.warn("Asteroide no índice", index, "não encontrado para destruição.");
        return;
    }

    let hackerId = a.isHacked ? a.hackerId : null;
    if (a.bountyValue > 0) {
        socket.emit('asteroidDestroyed', { roomId: minhaRoomId, bountyValue: a.bountyValue, hackerId: hackerId });
    }

    if (a.tipo === 'bomber') {
        detonarBomba(a);
        asteroides.splice(index, 1); 
        return;
    }
    if (a.tipo === 'inhibitor') {
        socket.emit('inhibitorDestroyed', { roomId: minhaRoomId, inhibitorId: a.id });
        explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: 'purple' });
        asteroides.splice(index, 1);
        return;
    }
     if (a.tipo === 'mine') { 
        explosoes.push({ x: a.x, y: a.y, raio: a.explosionRadius, vida: 10, vidaMax: 10, cor: "orange" });
        aplicarDanoEmArea(a.x, a.y, a.explosionRadius, -1); 
        socket.emit('mineExpiredOrDetonated', { roomId: minhaRoomId, mineId: a.id, ownerId: a.ownerId });
        asteroides.splice(index, 1);
        return;
    }

    explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: a.atira ? "yellow" : (a.tipo === 'spectral' ? 'lightblue' : (a.tipo === 'hunter' ? 'orange' : (a.tipo === 'disruptor' ? 'purple' : 'white'))) });

    if(meuEstado.upgrades?.impactShrapnel > 0 && a.tipo === 'normal') {
        criarShrapnel(a.x, a.y);
    }

    const volatileLevel = meuEstado.upgrades?.volatileCore || 0;
    if(volatileLevel > 0 && ['normal', 'shooter'].includes(a.tipo)) {
        const chance = volatileLevel * 0.15 + 0.05; 
        if(Math.random() < chance) {
            aplicarDanoEmArea(a.x, a.y, 30, index); 
        }
    }

    if (['normal', 'shooter'].includes(a.tipo)) {
        const pv = a.velocidade;
        let p1 = { x: -pv.y, y: pv.x }; let p1_mag = Math.sqrt(p1.x**2 + p1.y**2); if (p1_mag > 0) { p1.x /= p1_mag; p1.y /= p1_mag; } else { p1 = {x: 1, y: 0}; }
        let p2 = { x: pv.y, y: -pv.x }; let p2_mag = Math.sqrt(p2.x**2 + p2.y**2); if (p2_mag > 0) { p2.x /= p2_mag; p2.y /= p2_mag; } else { p2 = {x: -1, y: 0}; }
        let push = { x: (hitVelocity.x || 0) * 0.1, y: (hitVelocity.y || 0) * 0.1 }; 
        const randKick1 = (Math.random() * 0.5 + 0.5); const randKick2 = (Math.random() * 0.5 + 0.5);
        const vel1 = { x: pv.x + p1.x * randKick1 + push.x, y: pv.y + p1.y * randKick1 + push.y };
        const vel2 = { x: pv.x + p2.x * randKick2 + push.x, y: pv.y + p2.y * randKick2 + push.y };
        const options1 = { overrideVelocity: vel1, tipo: a.tipo, advancedTargeting: a.advancedTargeting, reinforcedHull: a.reinforcedHull }; 
        const options2 = { overrideVelocity: vel2, tipo: a.tipo, advancedTargeting: a.advancedTargeting, reinforcedHull: a.reinforcedHull };
        let novoTamanho = a.tamanho / 2;
        if (novoTamanho >= 25) {
            let ast1 = criarNovoAsteroide(novoTamanho, a.x, a.y, options1);
            let ast2 = criarNovoAsteroide(novoTamanho, a.x, a.y, options2);
            ast1.vida = a.vidaMaxima * 0.6; ast1.vidaMaxima = a.vidaMaxima * 0.6;
            ast2.vida = a.vidaMaxima * 0.6; ast2.vidaMaxima = a.vidaMaxima * 0.6;
            ast1.bountyValue = Math.floor(a.bountyValue / 2); ast2.bountyValue = Math.floor(a.bountyValue / 2);

            asteroides.push(ast1, ast2);
        }
    }

    asteroides.splice(index, 1); 
}

function aplicarDanoEmArea(x, y, raio, indexIgnorado) {
    explosoes.push({ x: x, y: y, raio: raio, vida: 10, vidaMax: 10, cor: "#FF4500" });

    if (meuEstado.upgrades?.napalmFragments > 0) {
        criarNapalmArea(x, y, raio * 0.8); 
    }

    for (let i = asteroides.length - 1; i >= 0; i--) {
        if (i === indexIgnorado) continue;
        const asteroide = asteroides[i];
        if (!asteroide) continue;
        const dist = distanciaEntrePontos(x, y, asteroide.x, asteroide.y);
        if (dist < raio + asteroide.raio) {
            asteroide.vida -= 1.5; 

        }
    }

    for (let i = asteroidesNeutros.length - 1; i >= 0; i--) {
        const asteroide = asteroidesNeutros[i];
        if (!asteroide) continue;
        const dist = distanciaEntrePontos(x, y, asteroide.x, asteroide.y);
        if (dist < raio + asteroide.raio) {
            asteroide.vida -= 1.5; 
            if (asteroide.vida <= 0) {
                explosoes.push({ x: asteroide.x, y: asteroide.y, raio: asteroide.raio, vida: 10, vidaMax: 10, cor: asteroide.cor });
                const id = asteroide.id; 
                asteroidesNeutros.splice(i, 1);
                socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: asteroide.x, y: asteroide.y }); 
            }
        }
    }
}

function distanciaEntrePontos(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)); }

function isLaserHitting(laserX, laserY, laserAngle, circle) { const dx = Math.cos(laserAngle); const dy = Math.sin(laserAngle); const ltcX = circle.x - laserX; const ltcY = circle.y - laserY; const t = ltcX * dx + ltcY * dy; let cX, cY; if (t < 0) return null; else { cX = laserX + t * dx; cY = laserY + t * dy; } const dist = distanciaEntrePontos(cX, cY, circle.x, circle.y); if (dist < circle.raio) return { x: cX, y: cY }; return null; }

function detectarColisoes() {
    if (!nave || !meuEstado || !meuEstado.upgrades) return; const upg = meuEstado.upgrades; const ang = nave.angulo;

    if (isLaserActive) { const pX = nave.x + 4/3 * nave.raio * Math.cos(ang); const pY = nave.y + 4/3 * nave.raio * Math.sin(ang); let dmg = 0.2 + (upg.laser * 0.1)*(1+(upg.laserAmplifier||0)*0.1); let isUlt = upg.ultimate_laser > 0; let isPrism = upg.ultimate_prism > 0; if (isUlt) { dmg = 1.5 * (1+(upg.laserAmplifier||0)*0.1); for (let k = tirosInimigos.length - 1; k >= 0; k--) { const t = tirosInimigos[k]; if (isLaserHitting(pX, pY, ang, {x: t.x, y: t.y, raio: 5})) { explosoes.push({ x: t.x, y: t.y, raio: 10, vida: 5, vidaMax: 5, cor: "cyan" }); tirosInimigos.splice(k, 1); socket.emit('enemyProjectileDestroyed', minhaRoomId); } } } let hits = []; for (let j = asteroides.length - 1; j >= 0; j--) { const a = asteroides[j]; if (!a) continue; const hP = isLaserHitting(pX, pY, ang, a); if (hP) { if (a.laserHitTimer <= 0) { a.vida -= dmg; a.laserHitTimer = 0.25; if (a.vida <= 0) destruirAsteroide(j, { x: Math.cos(ang), y: Math.sin(ang) }); else if (isPrism) hits.push({ ast: a, point: hP }); } } } for (let j = asteroidesNeutros.length - 1; j >= 0; j--) { const a = asteroidesNeutros[j]; if (!a) continue; const hP = isLaserHitting(pX, pY, ang, a); if (hP) { if (a.laserHitTimer <= 0) { a.vida -= dmg; a.laserHitTimer = 0.25; if (a.vida <= 0) { const id=a.id; explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: a.cor }); asteroidesNeutros.splice(j, 1); socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: a.x, y: a.y }); } else if (isPrism) hits.push({ ast: a, point: hP }); } } } if (isPrism && hits.length > 0) { hits.sort((a, b) => distanciaEntrePontos(pX, pY, a.point.x, a.point.y) - distanciaEntrePontos(pX, pY, b.point.x, b.point.y)); const fH = hits[0]; criarFeixeSecundario(fH.point.x, fH.point.y, ang, fH.ast); } secondaryLaserBeams = secondaryLaserBeams.filter(b => b.vida > 0); for (let b of secondaryLaserBeams) { b.vida--; let sDmg = dmg * PRISM_DAMAGE_FACTOR; for (let j = asteroides.length - 1; j >= 0; j--) { const a = asteroides[j]; if (!a || a.id === b.ignoreId) continue; const hP = isLaserHitting(b.startX, b.startY, b.angulo, a); if (hP && distanciaEntrePontos(b.startX, b.startY, hP.x, hP.y) < 500) { if (a.laserHitTimer <= 0) { a.vida -= sDmg; a.laserHitTimer = 0.25; if (a.vida <= 0) destruirAsteroide(j, { x: Math.cos(b.angulo), y: Math.sin(b.angulo) }); } } }  } }

    for (let i = nave.lasers.length - 1; i >= 0; i--) {
        const l = nave.lasers[i];
        if (!l) continue;
        let hit = false;

        for (let j = asteroides.length - 1; j >= 0; j--) {
            const a = asteroides[j];
            if (!a) continue;

            if (distanciaEntrePontos(l.x, l.y, a.x, a.y) < a.raio) {
                let dmgMult = (upg.superchargeCore||0)*0.05 + 1.0;
                let realDmg = l.dano * dmgMult;

                if(a.reinforcedHull && !l.eMissil && !l.eSingularity && !l.eBattery) realDmg = Math.max(0, realDmg - 1);

                a.vida -= realDmg;

                a.laserHitTimer = 0.25;
                hit = true;

                if (upg.cryoAmmo > 0 && !l.eMissil && !l.eCluster && !l.eSingularity) {
                    a.slowEffectDuration = CRYO_DURATION;
                    if(upg.deepFreeze > 0 && a.tamanho <= 25 && Math.random() < 0.2) { a.slowEffectDuration = 1.0; }
                }

                if (a.vida <= 0) {

                    if(upg.chainReaction > 0 && Math.random() < 0.2 && !l.eShrapnel) aplicarDanoEmArea(a.x, a.y, 30, j);
                    destruirAsteroide(j, l.velocidade);
                }

                if (l.eHoming && upg.enhancedCharge > 0) aplicarDanoEmArea(l.x, l.y, 30, j);

                if(upg.unstableMunitions > 0 && !l.eMissil && !l.eCluster && !l.eSingularity && Math.random() < 0.15) aplicarDanoEmArea(l.x, l.y, 20, j);

                if (l.eCluster) {

                }
                else if (l.eMissil) {

                    let raioMissil = (upg.ultimate_barrage > 0) ? 75 : 50;
                    aplicarDanoEmArea(l.x, l.y, raioMissil, j);
                    if(upg.ricochetMissiles > 0) {
                        criarRicochetMicroMissile(l.x, l.y, l.angulo + Math.PI/2);
                        criarRicochetMicroMissile(l.x, l.y, l.angulo - Math.PI/2);
                    }
                    nave.lasers.splice(i, 1);
                    break;

                }
                else if (l.eSingularity) {

                }
                else if (l.eOrbitalMarker) {
                    socket.emit('activateOrbitalMarker', {roomId: minhaRoomId, targetX: a.x, targetY: a.y});
                    nave.lasers.splice(i,1);
                    break;
                } else {
                    if (l.pierceCount > 0) {
                        l.pierceCount--;
                    } else {
                        nave.lasers.splice(i, 1);
                        break;
                    }
                }
            }
        }

        if (i >= nave.lasers.length) continue;

        if (!hit || (l.pierceCount !== undefined && l.pierceCount >= 0)) {

            for (let k = asteroidesNeutros.length - 1; k >= 0; k--) {
                const a = asteroidesNeutros[k];
                if (!a) continue;

                if (distanciaEntrePontos(l.x, l.y, a.x, a.y) < a.raio) {
                    let dmgMult = (upg.superchargeCore||0)*0.05 + 1.0;
                    let realDmg = l.dano * dmgMult;

                    a.vida -= realDmg;

                    a.laserHitTimer = 0.25;
                    hit = true;

                    if (upg.cryoAmmo > 0 && !l.eMissil && !l.eCluster && !l.eSingularity) {
                        a.slowEffectDuration = CRYO_DURATION;
                        if(upg.deepFreeze > 0 && a.tamanho <= 25 && Math.random() < 0.2) {
                            a.slowEffectDuration = 1.0;
                        }
                    }

                    if (a.vida <= 0) {

                        if(upg.chainReaction > 0 && Math.random() < 0.2 && !l.eShrapnel) aplicarDanoEmArea(a.x, a.y, 30, -1);

                        const id = a.id;
                        explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: a.cor });
                        asteroidesNeutros.splice(k, 1);
                        socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: a.x, y: a.y });
                    }

                    if (l.eHoming && upg.enhancedCharge > 0) aplicarDanoEmArea(l.x, l.y, 30, -1);
                    if(upg.unstableMunitions > 0 && !l.eMissil && !l.eCluster && !l.eSingularity && Math.random() < 0.15) aplicarDanoEmArea(l.x, l.y, 20, -1);

                    if (l.eCluster) { }
                    else if (l.eMissil) {
                        let raioMissil = (upg.ultimate_barrage > 0) ? 75 : 50;
                        aplicarDanoEmArea(l.x, l.y, raioMissil, -1);
                         if(upg.ricochetMissiles > 0) {
                            criarRicochetMicroMissile(l.x, l.y, l.angulo + Math.PI/2);
                            criarRicochetMicroMissile(l.x, l.y, l.angulo - Math.PI/2);
                        }
                        nave.lasers.splice(i, 1);
                        break;
                    }
                    else if (l.eSingularity) { }
                    else if (l.eOrbitalMarker) {
                        socket.emit('activateOrbitalMarker', {roomId: minhaRoomId, targetX: a.x, targetY: a.y});
                        nave.lasers.splice(i,1);
                        break;
                    } else {
                        if (l.pierceCount > 0) {
                            l.pierceCount--;
                        } else {
                            nave.lasers.splice(i, 1);
                            break;
                        }
                    }
                } 
            } 
        } 
    }

    if (!nave.invencivel) {
        for (let i = asteroides.length - 1; i >= 0; i--) {
            const a = asteroides[i];
            if (distanciaEntrePontos(nave.x, nave.y, a.x, a.y) < nave.raio + a.raio) {
                let tookDmg = true;
                if(upg.kineticAccelerator > 0 && nave.acelerando && Math.abs(anguloNormalizado(nave.angulo - Math.atan2(a.y - nave.y, a.x - nave.x))) < Math.PI / 4) {
                    const speed = Math.sqrt(nave.velocidade.x**2 + nave.velocidade.y**2);
                    a.vida -= speed * 2;

                    a.laserHitTimer = 0.25;
                    if (a.vida <= 0) destruirAsteroide(i, nave.velocidade);
                    tookDmg = false;
                    explosoes.push({x: a.x, y: a.y, raio: a.raio * 0.8, vida: 10, vidaMax: 10, cor: "orange"});
                }
                if(tookDmg) {
                    if (nave.escudoAtual >= 1) {
                        nave.escudoAtual--;
                        nave.escudoRegenTimer = 5.0;
                        if(upg.batteryCannons > 0 && batteryCannonCharges < 3) { batteryCannonCharges++; batteryChargesEl.textContent = batteryCannonCharges; }
                        destruirAsteroide(i, nave.velocidade);
                    } else {
                        socket.emit('playerHit', minhaRoomId);
                        reiniciarNaveAposHit();
                        destruirAsteroide(i, nave.velocidade);
                    }
                }
                break;
            }
        }

        for (let i = asteroidesNeutros.length - 1; i >= 0; i--) {
            const a = asteroidesNeutros[i];
             if (distanciaEntrePontos(nave.x, nave.y, a.x, a.y) < nave.raio + a.raio) {
                if (nave.escudoAtual >= 1) {
                    nave.escudoAtual--;
                    nave.escudoRegenTimer = 5.0;
                    if(upg.batteryCannons > 0 && batteryCannonCharges < 3) { batteryCannonCharges++; batteryChargesEl.textContent = batteryCannonCharges; }
                } else {
                    socket.emit('playerHit', minhaRoomId);
                    reiniciarNaveAposHit();
                }

                const id = a.id;
                explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: a.cor });
                asteroidesNeutros.splice(i, 1);
                socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: a.x, y: a.y });
                break; 
             }
        }
    }

    if (!nave.invencivel) { for (let i = tirosInimigos.length - 1; i >= 0; i--) { const t = tirosInimigos[i]; if (distanciaEntrePontos(nave.x, nave.y, t.x, t.y) < nave.raio + t.raio) { let absorbed = false; if (nave.escudoAtual >= 1 && !t.isSpectral) { nave.escudoAtual--; nave.escudoRegenTimer = 5.0; absorbed = true; if(upg.batteryCannons > 0 && batteryCannonCharges < 3) { batteryCannonCharges++; batteryChargesEl.textContent = batteryCannonCharges; } if(upg.ultimate_effConversion > 0 && Math.random() < 0.1) {  } } if (!absorbed) { if (t.isToxic) { nave.corrosionDuration = TOXIC_SHARD_DURATION; nave.escudoRegenTimer = TOXIC_SHARD_DURATION; } socket.emit('playerHit', minhaRoomId); reiniciarNaveAposHit(); } tirosInimigos.splice(i, 1); break; } } }

    for(let i = explosoes.length - 1; i >= 0; i--) { const e = explosoes[i]; if (e.cor && e.cor.startsWith("rgba(0, 180, 255")) { for (let j = tirosInimigos.length - 1; j >= 0; j--) { const t = tirosInimigos[j]; if (distanciaEntrePontos(e.x, e.y, t.x, t.y) < e.raio) { explosoes.push({ x: t.x, y: t.y, raio: 5, vida: 5, vidaMax: 5, cor: "white" }); tirosInimigos.splice(j, 1); socket.emit('enemyProjectileDestroyed', minhaRoomId); } } } }

    for (let i = lootContainers.length - 1; i >= 0; i--) { const l = lootContainers[i]; if (distanciaEntrePontos(nave.x, nave.y, l.x, l.y) < nave.raio + l.raio) { if (l.type === 'money') socket.emit('lootCollected', { roomId: minhaRoomId, amount: l.amount }); else if (l.type === 'powerup') socket.emit('powerupCollected', { roomId: minhaRoomId, powerupType: l.powerupType }); lootContainers.splice(i, 1); } }

    for (let i = minasEnviadas.length - 1; i >= 0; i--) { const m = minasEnviadas[i]; if (!m.armed) continue; let det = false; if (distanciaEntrePontos(nave.x, nave.y, m.x, m.y) < nave.raio + MINE_TRIGGER_RADIUS) { det = true; if (!nave.invencivel) {  if (nave.escudoAtual >= 1) { nave.escudoAtual = 0; nave.escudoRegenTimer = 3.0; } else { socket.emit('playerHit', minhaRoomId); reiniciarNaveAposHit(); } } } if (!det) { const tA = [...asteroides, ...asteroidesNeutros]; for(const a of tA) { if (distanciaEntrePontos(a.x, a.y, m.x, m.y) < a.raio + MINE_TRIGGER_RADIUS) { det = true; a.vida -= m.damage / 2; if (a.vida <= 0) { if (asteroides.includes(a)) destruirAsteroide(asteroides.indexOf(a)); else if (asteroidesNeutros.includes(a)) { const id=a.id; explosoes.push({ x: a.x, y: a.y, raio: a.raio, vida: 10, vidaMax: 10, cor: a.cor }); asteroidesNeutros.splice(asteroidesNeutros.indexOf(a), 1); socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: a.x, y: a.y }); } } break; } } } if (det) { explosoes.push({ x: m.x, y: m.y, raio: m.explosionRadius, vida: 10, vidaMax: 10, cor: "orange" }); aplicarDanoEmArea(m.x, m.y, m.explosionRadius, -1); minasEnviadas.splice(i, 1); socket.emit('mineExpiredOrDetonated', { roomId: minhaRoomId, mineId: m.id, ownerId: m.ownerId }); } }

    const allAst = [...asteroides, ...asteroidesNeutros]; for (const area of napalmAreas) { for (const ast of allAst) { if (distanciaEntrePontos(area.x, area.y, ast.x, ast.y) < area.radius + ast.raio) { ast.vida -= NAPALM_DAMAGE * deltaTime * 30; if (ast.vida <= 0) { if (asteroides.includes(ast)) destruirAsteroide(asteroides.indexOf(ast)); else if (asteroidesNeutros.includes(ast)) { const id = ast.id; explosoes.push({ x: ast.x, y: ast.y, raio: ast.raio, vida: 10, vidaMax: 10, cor: ast.cor }); asteroidesNeutros.splice(asteroidesNeutros.indexOf(ast), 1); socket.emit('neutralAsteroidDestroyed', { roomId: minhaRoomId, asteroidId: id, x: ast.x, y: ast.y }); } } } } }
}

function reiniciarNaveAposHit() {
    nave.x = canvas.width / 2; nave.y = canvas.height / 2;
    nave.velocidade = { x: 0, y: 0 };
    nave.invencivel = true; nave.contadorInvencibilidade = DURACAO_INVENCIBILIDADE;
    nave.escudoAtual = 0; nave.escudoRegenTimer = 5.0;
    nave.corrosionDuration = 0;

    screenShake = 15;
}

function spawnMerchantVisual() {
    merchantVisible = true;
    merchantContainer.style.display = 'block';
    merchantItemsEl.innerHTML = ''; 

    const possibleItems = [
        { key: 'bonusMoney', text: "+$150 Dinheiro", cost: 50 },
        { key: 'instantShield', text: "Escudo Cheio", cost: 75 },
        { key: 'rapidFireBoost', text: "Tiro Rápido (5s)", cost: 100 }

    ];

    let itemsToShow = [...possibleItems].sort(() => 0.5 - Math.random()).slice(0, 2);

    itemsToShow.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = `${item.text} ($${item.cost})`;
        btn.onclick = () => {
            if (meuEstado.dinheiro >= item.cost) {
                socket.emit('buyMerchantItem', { roomId: minhaRoomId, itemKey: item.key, cost: item.cost });

                merchantItemsEl.querySelectorAll('button').forEach(b => b.disabled = true);
            } else {

                 btn.style.borderColor = 'red';
                 setTimeout(() => btn.style.borderColor = '#777', 300);
            }
        };

        btn.disabled = meuEstado.dinheiro < item.cost;
        merchantItemsEl.appendChild(btn);
    });

    let timeLeft = 10;
    merchantTimerEl.textContent = `Tempo restante: ${timeLeft}s`;
    if (merchantTimerInterval) clearInterval(merchantTimerInterval); 
    merchantTimerInterval = setInterval(() => {
        timeLeft--;
        merchantTimerEl.textContent = `Tempo restante: ${timeLeft}s`;
        if (timeLeft <= 0) {
            removeMerchantVisual(); 
        }
    }, 1000);
}

function removeMerchantVisual() {
    merchantVisible = false;
    merchantContainer.style.display = 'none';
    if (merchantTimerInterval) clearInterval(merchantTimerInterval);
    merchantTimerInterval = null;
}

function activateStasisEffect(ownerId) {
     activeStasisField = {
         ownerId: ownerId,
         endTime: Date.now() + STASIS_DURATION * 1000
     };

     explosoes.push({ x: nave.x, y: nave.y, raio: 200, vida: 15, vidaMax: 15, cor: "rgba(150, 150, 255, 0.5)" });
}

function anguloNormalizado(angle) {
    while (angle <= -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;
    return angle;
}