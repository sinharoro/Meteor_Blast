window.focus();

// --- Supabase Configuration ---
// TODO: Replace with actual Supabase URL and key from .env.local
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your_anon_key_here'

let supabaseClient = null
if (typeof supabase !== 'undefined' && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('your-project')) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  } catch (e) {
    console.warn('Supabase not available, leaderboard disabled')
  }
}

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const quitBtn = document.getElementById('quit-btn');
const quitModal = document.getElementById('quit-modal');
const confirmQuitBtn = document.getElementById('confirm-quit');
const cancelQuitBtn = document.getElementById('cancel-quit');
const closeBtn = document.getElementById('close-btn');
const scoreList = document.getElementById('score-list');
const healthBarFill = document.getElementById('health-bar-fill');
const loginScreen = document.getElementById('login-screen');
const nameInput = document.getElementById('player-initials');
const startButton = document.getElementById('start-btn');

canvas.width = 850;
canvas.height = 450;

// --- Game State ---
let currentPlayerName = "";
let score = 0;
let gameRunning = false; 
let isPaused = false;
let lastFireTime = 0;
const fireRate = 100;
let shakeTimer = 0;

// Shockwave State
let shockwaveActive = false;
let shockwaveRadius = 0;
const MAX_SHOCKWAVE = 1200; 

const bullets = [];
const enemies = [];
const bigenemies = [];
const particles = [];
const stars = [];
const powerUps = [];
const keys = {};

// --- OPTIMIZATION: Sprite Cache ---
const spriteCache = {};
function getEmojiSprite(emoji, size) {
    const key = `${emoji}-${size}`;
    if (spriteCache[key]) return spriteCache[key];

    const offCanvas = document.createElement('canvas');
    offCanvas.width = size * 1.5;
    offCanvas.height = size * 1.5;
    const offCtx = offCanvas.getContext('2d');
    offCtx.font = `${size}px Arial`;
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillText(emoji, offCanvas.width / 2, offCanvas.height / 2);
    
    spriteCache[key] = offCanvas;
    return offCanvas;
}

for (let i = 0; i < 60; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: 0.5 + Math.random() * 2
    });
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.w = 30;
        this.h = 30;
        this.speed = 2;
    }
    update() {
        this.x -= this.speed;
        // Fixed hitbox - tighter collision detection
        const px = player.x + 5, py = player.y + 5;
        const pw = player.w - 10, ph = player.h - 10;
        if (px < this.x + this.w && px + pw > this.x &&
            py < this.y + this.h && py + ph > this.y) {
            this.applyEffect();
            return true;
        }
        return this.x + this.w < 0;
    }
    draw() {
        ctx.save();
        let emoji = "💎";
        if (this.type === 'shield') emoji = "🔧";
        else if (this.type === 'score') emoji = "💎";
        else if (this.type === 'rapid-fire') emoji = "🔥";
        
        const sprite = getEmojiSprite(emoji, 25);
        ctx.drawImage(sprite, this.x, this.y);
        ctx.restore();
    }
    applyEffect() {
        if (navigator.vibrate) navigator.vibrate(50);
        if (this.type === 'shield') {
            player.health = Math.min(player.health + 30, 100);
            healthBarFill.style.width = player.health + "%";
        } else if (this.type === 'score') {
            score += 500;
            scoreEl.innerText = `Score: ${score}`;
        } else if (this.type === 'rapid-fire') {
            player.isRapidFiring = true;
            if (player.rapidFireTimer) clearTimeout(player.rapidFireTimer);
            player.rapidFireTimer = setTimeout(() => { player.isRapidFiring = false; }, 7000);
        }
    }
}

// --- Database Functions ---
async function getHighScores() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('name, score')
            .order('score', { ascending: false })
            .limit(5);

        if (error) console.error('Error fetching scores:', error);
        else updateLeaderboardUI(data);
    } catch(e) {
        console.warn('Leaderboard unavailable');
    }
}

async function saveScore(playerName, playerScore) {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('leaderboard')
            .insert([{ name: playerName, score: playerScore }]);

        if (error) console.error('Error saving score:', error);
        else getHighScores();
    } catch(e) {
        console.warn('Leaderboard unavailable');
    }
}

function updateLeaderboardUI(scores) {
    if (!scoreList || !scores) return;
    scoreList.innerHTML = scores
        .map((s, i) => `<li>${i + 1}. ${s.name.toUpperCase()} - ${s.score}</li>`)
        .join('');
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.color = color;
        this.life = 1.0; 
        this.decay = Math.random() * 0.03 + 0.02;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class Player {
    constructor() {
        this.x = 12;
        this.y = canvas.height / 2;
        this.w = 45;
        this.h = 30;
        this.speed = 6.5;
        this.color = "#00FF00";
        this.health = 100;
        this.repairRate = 0.00833;
        this.emergencyUsed = false;
        this.isRapidFiring = false; 
        this.rapidFireTimer = null; 
        this.rotation = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        
        // Dynamic Banking
        if (keys['ArrowUp']) this.rotation = -0.12;
        else if (keys['ArrowDown']) this.rotation = 0.12;
        else this.rotation *= 0.85;
        ctx.rotate(this.rotation);

        // Thruster Glow
        if (gameRunning) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00d4ff";
            ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#00d4ff";
            ctx.beginPath();
            ctx.moveTo(-this.w / 2, -6);
            ctx.lineTo(-this.w / 2 - (15 + Math.random() * 12), 0);
            ctx.lineTo(-this.w / 2, 6);
            ctx.fill();
        }

        // --- SHIELD REMOVAL LOGIC ---
        // Shield aura only exists if health > 25 AND emergency has NOT been used
        if (this.health > 25 && !this.emergencyUsed) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${this.health / 250})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, 38, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Ship Body
        ctx.shadowBlur = this.isRapidFiring ? 20 : 5;
        ctx.shadowColor = this.isRapidFiring ? "red" : "#00FF00";
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.moveTo(-20, -10); ctx.lineTo(25, 0); ctx.lineTo(-20, 10); ctx.lineTo(-10, 0);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-10, -15); ctx.lineTo(10, -5); ctx.lineTo(10, 5); ctx.lineTo(-10, 15);
        ctx.fill();

        ctx.restore();
    }

    update() {
        if (keys['ArrowUp'] && this.y > 10) this.y -= this.speed;
        if (keys['ArrowDown'] && this.y < canvas.height - this.h - 10) this.y += this.speed;
        if (keys['ArrowLeft'] && this.x > 12) this.x -= this.speed;
        if (keys['ArrowRight'] && this.x < canvas.width * .65) this.x += this.speed;
        
        if (gameRunning && this.health < 100 && !this.emergencyUsed) {
            this.health += this.repairRate;
            if (this.health > 100) this.health = 100;
            healthBarFill.style.width = this.health + "%";
        }
    }

    triggerEmergencyEffect() {
        const label = document.getElementById('shield-label');
        if (label) {
            label.innerText = "EMERGENCY POWER"; 
            label.style.color = "#ff3333";
        }
        healthBarFill.style.backgroundColor = "#00FF00";
        shockwaveActive = true;
        shockwaveRadius = 0;
        shakeTimer = 30;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 10 && !this.emergencyUsed) {
            this.health = 100;
            this.emergencyUsed = true;
            this.triggerEmergencyEffect();
        }
        if (this.health <= 0) {
            this.health = 0;
            stopGame("Mission Failed Successfully...");
        }
        healthBarFill.style.width = this.health + "%";
    }
}

const player = new Player();

function createExplosion(x, y, color, count) {
    if (particles.length > 150) return;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnEnemy() {
    const spawnRange = canvas.height - 50;
    if (Math.random() < 0.2) {
        enemies.push({
            x: canvas.width,
            y: Math.random() * spawnRange,
            w: 30, h: 30, hp: 1,
            speed: 3 + Math.random() * 2,
            velocityY: (Math.random() - 0.5) * 2,
            rotation: 0,
            spin: (Math.random() - 0.5) * 0.1
        });
    }
}

function spawnBigEnemy() {
    const spawnRange = canvas.height - 70;
    if (Math.random() < 0.02) {
        bigenemies.push({
            x: canvas.width,
            y: Math.random() * spawnRange,
            w: 60, h: 60, hp: 5,
            speed: 2 + Math.random() * 2,
            velocityY: (Math.random() - 0.5) * 2,
            rotation: 0,
            spin: (Math.random() - 0.5) * 0.05
        });
    }
}

function update() {
    if (!gameRunning || isPaused) return;

    player.update();

    if (shockwaveActive) {
        shockwaveRadius += 35;
        // Fixed: use reverse iteration for shockwave collision
        for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            const dx = en.x - player.x; const dy = en.y - player.y;
            if (Math.sqrt(dx*dx + dy*dy) < shockwaveRadius) {
                createExplosion(en.x, en.y, "#00ffff", 5);
                enemies.splice(i, 1); score += 10; scoreEl.innerText = `Score: ${score}`;
            }
        }
        for (let i = bigenemies.length - 1; i >= 0; i--) {
            const ben = bigenemies[i];
            const dx = ben.x - player.x; const dy = ben.y - player.y;
            if (Math.sqrt(dx*dx + dy*dy) < shockwaveRadius) {
                createExplosion(ben.x, ben.y, "#ff0000", 15);
                bigenemies.splice(i, 1); score += 100; scoreEl.innerText = `Score: ${score}`;
            }
        }
        if (shockwaveRadius > MAX_SHOCKWAVE) shockwaveActive = false;
    }

    // --- UPDATED SHOOTING LOGIC ---
    const currentFireRate = player.isRapidFiring ? 35 : fireRate;
    if (keys['Space'] && Date.now() - lastFireTime > currentFireRate) {
        if (player.isRapidFiring) {
            // DOUBLE GUN WITH POWERUP
            bullets.push({ x: player.x + player.w, y: player.y + 5, r: 3, speed: 12, color: "#ff0000" });
            bullets.push({ x: player.x + player.w, y: player.y + player.h - 5, r: 3, speed: 12, color: "#ff0000" });
        } else {
            // SINGLE GUN DEFAULT
            bullets.push({ x: player.x + player.w, y: player.y + player.h / 2, r: 3, speed: 12, color: "#fff" });
        }
        lastFireTime = Date.now();
    }

    if (shakeTimer > 0) shakeTimer--;
    for (let i = powerUps.length - 1; i >= 0; i--) if (powerUps[i].update()) powerUps.splice(i, 1);
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].life <= 0) particles.splice(i, 1); }
    stars.forEach(s => { s.x -= s.speed; if (s.x < 0) s.x = canvas.width; });
    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].x += bullets[i].speed; if (bullets[i].x > canvas.width) bullets.splice(i, 1); }

    spawnEnemy();
    // BUG FIX: Use reverse iteration for enemy bullet collision
    for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        en.x -= en.speed; en.y += en.velocityY; en.rotation += en.spin;
        if (en.y <= 0 || en.y >= canvas.height - en.h) en.velocityY *= -1;
        
        // Player collision
        if (player.x < en.x + en.w && player.x + player.w > en.x && player.y < en.y + en.h && player.y + player.h > en.y) {
            shakeTimer = 15; player.takeDamage(20); enemies.splice(i, 1); continue;
        }
        
        // Bullet collision - FIXED: reverse iteration, break after hit
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
                createExplosion(en.x + 15, en.y + 15, "#9f9f9f", 8);
                enemies.splice(i, 1);
                bullets.splice(bi, 1);
                score += 10; scoreEl.innerText = `Score: ${score}`;
                break; // Stop checking bullets for this dead enemy
            }
        }
        if (en.x + en.w < 0) enemies.splice(i, 1);
    }

    spawnBigEnemy();
    for (let i = bigenemies.length - 1; i >= 0; i--) {
        const ben = bigenemies[i];
        ben.x -= ben.speed; ben.y += ben.velocityY; ben.rotation += ben.spin;
        if (ben.y <= 0 || ben.y >= canvas.height - ben.h) ben.velocityY *= -1;
        
        // Player collision
        if (player.x < ben.x + ben.w && player.x + player.w > ben.x && player.y < ben.y + ben.h && player.y + ben.h > ben.y) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            shakeTimer = 15; createExplosion(ben.x + 30, ben.y + 30, "red", 20);
            player.takeDamage(50); bigenemies.splice(i, 1); continue;
        }
        
        // Bullet collision - already using reverse iteration, verified with break
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            if (b.x > ben.x && b.x < ben.x + ben.w && b.y > ben.y && b.y < ben.y + ben.h) {
                bullets.splice(bi, 1); ben.hp -= 1; shakeTimer = 3; createExplosion(b.x, b.y, "orange", 5);
                if (ben.hp <= 0) {
                    createExplosion(ben.x + 30, ben.y + 30, "red", 25);
                    if (Math.random() < 0.3) {
                        const types = ['shield', 'score', 'rapid-fire'];
                        powerUps.push(new PowerUp(ben.x + 15, ben.y + 15, types[Math.floor(Math.random() * types.length)]));
                    }
                    bigenemies.splice(i, 1); score += 100; scoreEl.innerText = `Score: ${score}`; shakeTimer = 10;
                }
                break;
            }
        }
        if (ben.x + ben.w < 0) bigenemies.splice(i, 1);
    }
}

// FIX BUG 2: Separate update and draw into a proper game loop
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = "white";
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));

    if (gameRunning) {
        if (shakeTimer > 0) ctx.translate(Math.random() * 4 - 2, Math.random() * 4 - 2);
        particles.forEach(p => p.draw());
        powerUps.forEach(p => p.draw());
        player.draw(ctx);
        bullets.forEach(b => { 
            ctx.fillStyle = b.color || "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); 
        });

        enemies.forEach(en => {
            const sprite = getEmojiSprite("🪨", en.w);
            ctx.save(); ctx.translate(en.x + en.w/2, en.y + en.h/2); ctx.rotate(en.rotation);
            ctx.drawImage(sprite, -sprite.width/2, -sprite.height/2); ctx.restore();
        });

        bigenemies.forEach(ben => {
            const sprite = getEmojiSprite("🪨", ben.w);
            ctx.save(); ctx.translate(ben.x + ben.w/2, ben.y + ben.h/2); ctx.rotate(ben.rotation);
            ctx.drawImage(sprite, -sprite.width/2, -sprite.height/2); ctx.restore();
        });

        if (shockwaveActive) {
            ctx.save(); ctx.beginPath();
            ctx.arc(player.x + player.w/2, player.y + player.h/2, shockwaveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${1 - shockwaveRadius/MAX_SHOCKWAVE})`;
            ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 - (shockwaveRadius/MAX_SHOCKWAVE) * 0.15})`;
            ctx.fill(); ctx.restore();
        }
    }
    ctx.restore();
}

// FIX BUG 2: Proper game loop
function gameLoop() {
    update();
    draw();
    if (gameRunning || !loginScreen || loginScreen.style.display !== 'none') {
        requestAnimationFrame(gameLoop);
    }
}

getHighScores();

startButton.addEventListener('click', () => {
    if (nameInput.value.trim() !== "") currentPlayerName = nameInput.value.toUpperCase();
    loginScreen.style.display = 'none'; gameRunning = true; 
});

window.addEventListener('keydown', e => {
    if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if ((e.code === 'KeyP' || e.code === 'Escape') && gameRunning) if (quitModal.style.display !== 'flex') isPaused = !isPaused;
    if ((e.code === 'KeyQ') && gameRunning) { isPaused = true; quitModal.style.display = 'flex'; }
});

window.addEventListener('keyup', e => keys[e.code] = false);
quitBtn.addEventListener('click', () => { if (gameRunning) { isPaused = true; quitModal.style.display = 'flex'; } });
confirmQuitBtn.addEventListener('click', () => { quitModal.style.display = 'none'; stopGame("MISSION ABORTED"); });
cancelQuitBtn.addEventListener('click', () => { quitModal.style.display = 'none'; isPaused = false; });

const base = document.getElementById('joystick-base');
const stick = document.getElementById('joystick-stick');
const fireBtn = document.getElementById('mobile-fire-btn');
let joystickTouchId = null;

base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (joystickTouchId === null) { joystickTouchId = touch.identifier; handleJoystickUpdate(touch); }
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (joystickTouchId !== null) {
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joystickTouchId) { handleJoystickUpdate(e.touches[i]); e.preventDefault(); }
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joystickTouchId) { joystickTouchId = null; resetJoystick(); }
}, { passive: false });

function resetJoystick() {
    stick.style.transform = `translate(-50%, -50%)`;
    keys['ArrowUp'] = keys['ArrowDown'] = keys['ArrowLeft'] = keys['ArrowRight'] = false;
}

function handleJoystickUpdate(touch) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX; let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy); const maxRadius = rect.width / 2;
    if (distance > maxRadius) { dx *= maxRadius / distance; dy *= maxRadius / distance; }
    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const deadzone = 15; 
    keys['ArrowLeft'] = dx < -deadzone; keys['ArrowRight'] = dx > deadzone;
    keys['ArrowUp'] = dy < -deadzone; keys['ArrowDown'] = dy > deadzone;
}

fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys['Space'] = true; fireBtn.style.opacity = '0'; }, { passive: false });
fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['Space'] = false; fireBtn.style.opacity = '1'; }, { passive: false });

function resize() {
    const gameRatio = 850 / 450;
    const screenRatio = window.innerWidth / window.innerHeight;
    if (screenRatio > gameRatio) {
        canvas.style.width = (window.innerHeight * gameRatio) + 'px'; canvas.style.height = window.innerHeight + 'px';
    } else {
        canvas.style.width = window.innerWidth + 'px'; canvas.style.height = (window.innerWidth / gameRatio) + 'px';
    }
}
const fsBtn = document.getElementById('fullscreen-btn');
fsBtn.addEventListener('click', function() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); this.style.display = 'none'; } });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) fsBtn.style.display = 'block'; });

window.addEventListener('resize', resize);
resize();

// FIX BUG 8: Wait one frame before stopping
async function stopGame(msg = "MISSION FAILED SUCCESSFULLY") {
    gameRunning = false;
    isPaused = false;
    await new Promise(r => setTimeout(r, 16)); // Wait one frame
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff00"; ctx.textAlign = "center"; ctx.font = "bold 40px 'Courier New'"; 
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2 - 100);
    ctx.font = "bold 20px 'Courier New'"; ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 - 30);
    const spinner = document.getElementById('loading-spinner');
    if (spinner) { spinner.style.display = 'block'; spinner.style.top = '82%'; }
    try { await saveScore(currentPlayerName, score); await getHighScores(); }
    catch (error) { console.warn("Leaderboard unavailable:", error); }
    finally { setTimeout(() => { if (spinner) spinner.style.display = 'none'; resetGame(); }, 4000); }
}

// FIX BUG 5: Reset ALL player state properly
function resetGame() {
    // Reset ALL player state
    player.health = 100;
    player.emergencyUsed = false;
    player.isRapidFiring = false;
    if (player.rapidFireTimer) clearTimeout(player.rapidFireTimer);
    player.rapidFireTimer = null;
    player.x = 12;
    player.y = canvas.height / 2;
    player.rotation = 0;
    
    // Reset game state
    score = 0;
    scoreEl.innerText = `Score: 0`;
    shockwaveActive = false;
    shockwaveRadius = 0;
    shakeTimer = 0;
    lastFireTime = 0;
    
    // Clear arrays
    enemies.length = 0;
    bigenemies.length = 0;
    bullets.length = 0;
    particles.length = 0;
    powerUps.length = 0;
    Object.keys(keys).forEach(k => keys[k] = false);
    
    // Reset UI
    healthBarFill.style.width = "100%";
    healthBarFill.style.backgroundColor = "#00ffff";
    const label = document.getElementById('shield-label');
    if (label) { label.innerText = "SHIELD"; label.style.color = "#00ffff"; }
    
    // Show login AFTER setting gameRunning
    gameRunning = false;
    isPaused = false;
    loginScreen.style.display = 'flex';
}

// Start the game loop
gameLoop();