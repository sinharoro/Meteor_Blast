'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

interface Bullet {
  x: number;
  y: number;
  r: number;
  speed: number;
  color: string;
}

interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  speed: number;
  velocityY: number;
  rotation: number;
  spin: number;
}

interface BigEnemy extends Enemy {
  hp: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  life: number;
  decay: number;
}

interface PowerUp {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  speed: number;
}

interface Score {
  name: string;
  score: number;
}

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 450;
const FIRE_RATE = 100;
const MAX_SHOCKWAVE = 1200;

export default function MeteorBlast() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [showLogin, setShowLogin] = useState(true);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [emergencyUsed, setEmergencyUsed] = useState(false);
  const [shieldLabel, setShieldLabel] = useState('SHIELD');
  const [healthBarClass, setHealthBarClass] = useState('');

  const gameState = useRef({
    running: false,
    paused: false,
    lastFireTime: 0,
    shakeTimer: 0,
    shockwaveActive: false,
    shockwaveRadius: 0,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    bigenemies: [] as BigEnemy[],
    particles: [] as Particle[],
    powerUps: [] as PowerUp[],
    stars: [] as Star[],
    keys: {} as Record<string, boolean>,
    player: {
      x: 12,
      y: CANVAS_HEIGHT / 2,
      w: 45,
      h: 30,
      speed: 6.5,
      color: '#00FF00',
      health: 100,
      repairRate: 0.00833,
      emergencyUsed: false,
      isRapidFiring: false,
      rapidFireTimer: null as NodeJS.Timeout | null,
      rotation: 0,
    },
    spriteCache: {} as Record<string, HTMLCanvasElement>,
    currentPlayerName: '',
    isGameOver: false,
  });

  const getEmojiSprite = useCallback((emoji: string, size: number) => {
    const key = `${emoji}-${size}`;
    const cache = gameState.current.spriteCache;
    if (cache[key]) return cache[key];

    const offCanvas = document.createElement('canvas');
    offCanvas.width = size * 1.5;
    offCanvas.height = size * 1.5;
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.font = `${size}px Arial`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(emoji, offCanvas.width / 2, offCanvas.height / 2);

    cache[key] = offCanvas;
    return offCanvas;
  }, []);

  const initStars = useCallback(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2,
        speed: 0.5 + Math.random() * 2,
      });
    }
    gameState.current.stars = stars;
  }, []);

  const createExplosion = useCallback((x: number, y: number, color: string, count: number) => {
    if (gameState.current.particles.length > 150) return;
    for (let i = 0; i < count; i++) {
      gameState.current.particles.push({
        x,
        y,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 8,
        speedY: (Math.random() - 0.5) * 8,
        color,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
      });
    }
  }, []);

  const spawnEnemy = useCallback(() => {
    const spawnRange = CANVAS_HEIGHT - 50;
    if (Math.random() < 0.2) {
      gameState.current.enemies.push({
        x: CANVAS_WIDTH,
        y: Math.random() * spawnRange,
        w: 30,
        h: 30,
        hp: 1,
        speed: 3 + Math.random() * 2,
        velocityY: (Math.random() - 0.5) * 2,
        rotation: 0,
        spin: (Math.random() - 0.5) * 0.1,
      });
    }
  }, []);

  const spawnBigEnemy = useCallback(() => {
    const spawnRange = CANVAS_HEIGHT - 70;
    if (Math.random() < 0.02) {
      gameState.current.bigenemies.push({
        x: CANVAS_WIDTH,
        y: Math.random() * spawnRange,
        w: 60,
        h: 60,
        hp: 5,
        speed: 2 + Math.random() * 2,
        velocityY: (Math.random() - 0.5) * 2,
        rotation: 0,
        spin: (Math.random() - 0.5) * 0.05,
      });
    }
  }, []);

  const updateGame = useCallback(() => {
    const state = gameState.current;
    if (!state.running || state.paused) return;

    const player = state.player;

    if (keys['ArrowUp'] && player.y > 10) player.y -= player.speed;
    if (keys['ArrowDown'] && player.y < CANVAS_HEIGHT - player.h - 10) player.y += player.speed;
    if (keys['ArrowLeft'] && player.x > 12) player.x -= player.speed;
    if (keys['ArrowRight'] && player.x < CANVAS_WIDTH * 0.65) player.x += player.speed;

    if (state.running && player.health < 100 && !player.emergencyUsed) {
      player.health += player.repairRate;
      if (player.health > 100) player.health = 100;
      setHealth(player.health);
    }

    if (state.shockwaveActive) {
      state.shockwaveRadius += 35;
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const en = state.enemies[i];
        const dx = en.x - player.x;
        const dy = en.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < state.shockwaveRadius) {
          createExplosion(en.x, en.y, '#00ffff', 5);
          state.enemies.splice(i, 1);
          setScore((s) => s + 10);
        }
      }
      for (let i = state.bigenemies.length - 1; i >= 0; i--) {
        const ben = state.bigenemies[i];
        const dx = ben.x - player.x;
        const dy = ben.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < state.shockwaveRadius) {
          createExplosion(ben.x, ben.y, '#ff0000', 15);
          state.bigenemies.splice(i, 1);
          setScore((s) => s + 100);
        }
      }
      if (state.shockwaveRadius > MAX_SHOCKWAVE) state.shockwaveActive = false;
    }

    const currentFireRate = player.isRapidFiring ? 35 : FIRE_RATE;
    if (state.keys['Space'] && Date.now() - state.lastFireTime > currentFireRate) {
      if (player.isRapidFiring) {
        state.bullets.push({ x: player.x + player.w, y: player.y + 5, r: 3, speed: 12, color: '#ff0000' });
        state.bullets.push({ x: player.x + player.w, y: player.y + player.h - 5, r: 3, speed: 12, color: '#ff0000' });
      } else {
        state.bullets.push({ x: player.x + player.w, y: player.y + player.h / 2, r: 3, speed: 12, color: '#fff' });
      }
      state.lastFireTime = Date.now();
    }

    if (state.shakeTimer > 0) state.shakeTimer--;

    for (let i = state.powerUps.length - 1; i >= 0; i--) {
      const pu = state.powerUps[i];
      pu.x -= pu.speed;
      const px = player.x + 5;
      const py = player.y + 5;
      const pw = player.w - 10;
      const ph = player.h - 10;
      if (px < pu.x + pu.w && px + pw > pu.x && py < pu.y + pu.h && py + ph > pu.y) {
        if (navigator.vibrate) navigator.vibrate(50);
        if (pu.type === 'shield') {
          player.health = Math.min(player.health + 30, 100);
          setHealth(player.health);
        } else if (pu.type === 'score') {
          setScore((s) => s + 500);
        } else if (pu.type === 'rapid-fire') {
          player.isRapidFiring = true;
          if (player.rapidFireTimer) clearTimeout(player.rapidFireTimer);
          player.rapidFireTimer = setTimeout(() => {
            player.isRapidFiring = false;
          }, 7000);
        }
        state.powerUps.splice(i, 1);
      } else if (pu.x + pu.w < 0) {
        state.powerUps.splice(i, 1);
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    state.stars.forEach((s) => {
      s.x -= s.speed;
      if (s.x < 0) s.x = CANVAS_WIDTH;
    });

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      state.bullets[i].x += state.bullets[i].speed;
      if (state.bullets[i].x > CANVAS_WIDTH) state.bullets.splice(i, 1);
    }

    spawnEnemy();
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const en = state.enemies[i];
      en.x -= en.speed;
      en.y += en.velocityY;
      en.rotation += en.spin;
      if (en.y <= 0 || en.y >= CANVAS_HEIGHT - en.h) en.velocityY *= -1;

      if (player.x < en.x + en.w && player.x + player.w > en.x && player.y < en.y + en.h && player.y + player.h > en.y) {
        state.shakeTimer = 15;
        player.health -= 20;
        setHealth(player.health);
        state.enemies.splice(i, 1);
        continue;
      }

      for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
        const b = state.bullets[bi];
        if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
          createExplosion(en.x + 15, en.y + 15, '#9f9f9f', 8);
          state.enemies.splice(i, 1);
          state.bullets.splice(bi, 1);
          setScore((s) => s + 10);
          break;
        }
      }
      if (en.x + en.w < 0) state.enemies.splice(i, 1);
    }

    spawnBigEnemy();
    for (let i = state.bigenemies.length - 1; i >= 0; i--) {
      const ben = state.bigenemies[i];
      ben.x -= ben.speed;
      ben.y += ben.velocityY;
      ben.rotation += ben.spin;
      if (ben.y <= 0 || ben.y >= CANVAS_HEIGHT - ben.h) ben.velocityY *= -1;

      if (player.x < ben.x + ben.w && player.x + player.w > ben.x && player.y < ben.y + ben.h && player.y + ben.h > ben.y) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        state.shakeTimer = 15;
        createExplosion(ben.x + 30, ben.y + 30, 'red', 20);
        player.health -= 50;
        setHealth(player.health);
        state.bigenemies.splice(i, 1);
        continue;
      }

      for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
        const b = state.bullets[bi];
        if (b.x > ben.x && b.x < ben.x + ben.w && b.y > ben.y && b.y < ben.y + ben.h) {
          state.bullets.splice(bi, 1);
          ben.hp -= 1;
          state.shakeTimer = 3;
          createExplosion(b.x, b.y, 'orange', 5);
          if (ben.hp <= 0) {
            createExplosion(ben.x + 30, ben.y + 30, 'red', 25);
            if (Math.random() < 0.3) {
              const types = ['shield', 'score', 'rapid-fire'];
              state.powerUps.push({
                x: ben.x + 15,
                y: ben.y + 15,
                w: 30,
                h: 30,
                type: types[Math.floor(Math.random() * types.length)],
                speed: 2,
              });
            }
            state.bigenemies.splice(i, 1);
            setScore((s) => s + 100);
            state.shakeTimer = 10;
          }
          break;
        }
      }
      if (ben.x + ben.w < 0) state.bigenemies.splice(i, 1);
    }

    if (player.health <= 10 && !player.emergencyUsed) {
      player.health = 100;
      player.emergencyUsed = true;
      setEmergencyUsed(true);
      setShieldLabel('EMERGENCY POWER');
      state.shockwaveActive = true;
      state.shockwaveRadius = 0;
      state.shakeTimer = 30;
      setHealth(100);
    }
    if (player.health <= 0) {
      player.health = 0;
      setHealth(0);
      stopGame('Mission Failed Successfully...');
    }
  }, [createExplosion, spawnEnemy, spawnBigEnemy]);

  const drawGame = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = gameState.current;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    ctx.fillStyle = 'white';
    state.stars.forEach((s) => ctx.fillRect(s.x, s.y, s.size, s.size));

    if (state.running) {
      if (state.shakeTimer > 0)
        ctx.translate(Math.random() * 4 - 2, Math.random() * 4 - 2);

      state.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
      });

      state.powerUps.forEach((pu) => {
        ctx.save();
        let emoji = '💎';
        if (pu.type === 'shield') emoji = '🔧';
        else if (pu.type === 'score') emoji = '💎';
        else if (pu.type === 'rapid-fire') emoji = '🔥';

        const sprite = getEmojiSprite(emoji, 25);
        ctx.drawImage(sprite, pu.x, pu.y);
        ctx.restore();
      });

      const player = state.player;
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y + player.h / 2);

      if (state.keys['ArrowUp']) player.rotation = -0.12;
      else if (state.keys['ArrowDown']) player.rotation = 0.12;
      else player.rotation *= 0.85;
      ctx.rotate(player.rotation);

      if (state.running) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00d4ff';
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#00d4ff';
        ctx.beginPath();
        ctx.moveTo(-player.w / 2, -6);
        ctx.lineTo(-player.w / 2 - (15 + Math.random() * 12), 0);
        ctx.lineTo(-player.w / 2, 6);
        ctx.fill();
      }

      if (player.health > 25 && !player.emergencyUsed) {
        ctx.strokeStyle = `rgba(0, 255, 255, ${player.health / 250})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.shadowBlur = player.isRapidFiring ? 20 : 5;
      ctx.shadowColor = player.isRapidFiring ? 'red' : '#00FF00';
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(-20, -10);
      ctx.lineTo(25, 0);
      ctx.lineTo(-20, 10);
      ctx.lineTo(-10, 0);
      ctx.fill();

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(-10, -15);
      ctx.lineTo(10, -5);
      ctx.lineTo(10, 5);
      ctx.lineTo(-10, 15);
      ctx.fill();

      ctx.restore();

      state.bullets.forEach((b) => {
        ctx.fillStyle = b.color || '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      state.enemies.forEach((en) => {
        const sprite = getEmojiSprite('🪨', en.w);
        ctx.save();
        ctx.translate(en.x + en.w / 2, en.y + en.h / 2);
        ctx.rotate(en.rotation);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
      });

      state.bigenemies.forEach((ben) => {
        const sprite = getEmojiSprite('🪨', ben.w);
        ctx.save();
        ctx.translate(ben.x + ben.w / 2, ben.y + ben.h / 2);
        ctx.rotate(ben.rotation);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
      });

      if (state.shockwaveActive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, state.shockwaveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${1 - state.shockwaveRadius / MAX_SHOCKWAVE})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 - (state.shockwaveRadius / MAX_SHOCKWAVE) * 0.15})`;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }, [getEmojiSprite]);

  const keys = gameState.current.keys;

  useEffect(() => {
    initStars();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      gameState.current.keys[e.code] = true;
      if ((e.code === 'KeyP' || e.code === 'Escape') && gameState.current.running) {
        if (!gameState.current.paused) {
          gameState.current.paused = !gameState.current.paused;
        }
      }
      if (e.code === 'KeyQ' && gameState.current.running) {
        gameState.current.paused = true;
        setShowQuitModal(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initStars]);

  useEffect(() => {
    if (!showLogin) {
      gameState.current.running = true;
    }
  }, [showLogin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      updateGame();
      drawGame(ctx);
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [updateGame, drawGame]);

  const startGame = () => {
    const name = (document.getElementById('player-initials') as HTMLInputElement)?.value || '';
    setPlayerName(name.toUpperCase());
    gameState.current.currentPlayerName = name.toUpperCase();
    setShowLogin(false);
    gameState.current.running = true;
  };

  const handleQuit = () => {
    gameState.current.paused = true;
    setShowQuitModal(true);
  };

  const confirmQuit = () => {
    setShowQuitModal(false);
    stopGame('MISSION ABORTED');
  };

  const cancelQuit = () => {
    setShowQuitModal(false);
    gameState.current.paused = false;
  };

  const stopGame = async (msg: string) => {
    gameState.current.running = false;
    gameState.current.paused = false;
    gameState.current.isGameOver = true;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#00ff00';
      ctx.textAlign = 'center';
      ctx.font = "bold 40px 'Courier New'";
      ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
      ctx.font = "bold 20px 'Courier New'";
      ctx.fillText(`FINAL SCORE: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    }

    setShowLoading(true);

    setTimeout(async () => {
      resetGame();
    }, 4000);
  };

  const resetGame = () => {
    const state = gameState.current;
    state.player.health = 100;
    state.player.emergencyUsed = false;
    state.player.isRapidFiring = false;
    if (state.player.rapidFireTimer) clearTimeout(state.player.rapidFireTimer);
    state.player.rapidFireTimer = null;
    state.player.x = 12;
    state.player.y = CANVAS_HEIGHT / 2;
    state.player.rotation = 0;

    state.running = false;
    state.paused = false;
    state.isGameOver = false;
    state.shockwaveActive = false;
    state.shockwaveRadius = 0;
    state.shakeTimer = 0;
    state.lastFireTime = 0;
    state.enemies = [];
    state.bigenemies = [];
    state.bullets = [];
    state.particles = [];
    state.powerUps = [];
    Object.keys(state.keys).forEach((k) => (state.keys[k] = false));

    setScore(0);
    setHealth(100);
    setShowLogin(true);
    setShowLoading(false);
    setEmergencyUsed(false);
    setShieldLabel('SHIELD');
    setHealthBarClass('');
  };

  const getHealthBarClass = () => {
    if (emergencyUsed) return 'emergency';
    if (health <= 25) return 'critical';
    return '';
  };

  useEffect(() => {
    setHealthBarClass(getHealthBarClass());
  }, [health, emergencyUsed]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const gameRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
      const screenRatio = window.innerWidth / window.innerHeight;
      if (screenRatio > gameRatio) {
        canvas.style.width = window.innerHeight * gameRatio + 'px';
        canvas.style.height = window.innerHeight + 'px';
      } else {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerWidth / gameRatio + 'px';
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickStickRef = useRef<HTMLDivElement>(null);
  const [joystickTouchId, setJoystickTouchId] = useState<number | null>(null);

  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      if (joystickTouchId === null) {
        setJoystickTouchId(touches[i].identifier);
        handleJoystickUpdate(touches[i]);
      }
    }
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (joystickTouchId !== null) {
      const touches = e.touches;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === joystickTouchId) {
          handleJoystickUpdate(touches[i]);
          e.preventDefault();
        }
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === joystickTouchId) {
        setJoystickTouchId(null);
        resetJoystick();
      }
    }
  };

  const resetJoystick = () => {
    if (joystickStickRef.current) {
      joystickStickRef.current.style.transform = `translate(-50%, -50%)`;
    }
    gameState.current.keys['ArrowUp'] = false;
    gameState.current.keys['ArrowDown'] = false;
    gameState.current.keys['ArrowLeft'] = false;
    gameState.current.keys['ArrowRight'] = false;
  };

  const handleJoystickUpdate = (touch: Touch | React.Touch) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;
    if (distance > maxRadius) {
      dx *= maxRadius / distance;
      dy *= maxRadius / distance;
    }
    if (joystickStickRef.current) {
      joystickStickRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const deadzone = 15;
    gameState.current.keys['ArrowLeft'] = dx < -deadzone;
    gameState.current.keys['ArrowRight'] = dx > deadzone;
    gameState.current.keys['ArrowUp'] = dy < -deadzone;
    gameState.current.keys['ArrowDown'] = dy > deadzone;
  };

  const handleFireStart = (e: React.TouchEvent) => {
    e.preventDefault();
    gameState.current.keys['Space'] = true;
  };

  const handleFireEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    gameState.current.keys['Space'] = false;
  };

  return (
    <div id="ui-wrapper">
      <aside id="scoreboard">
        <div className="logo">
          <h1>METEOR BLAST</h1>
          <span>SPACE SHOOTER</span>
        </div>
        <h3>TOP PILOTS</h3>
        <ul id="score-list">
          {leaderboard.length > 0 ? (
            leaderboard.map((s, i) => (
              <li key={i} className={`rank-${i + 1}`}>
                {i + 1}. {s.name} - {s.score}
              </li>
            ))
          ) : (
            <li>Loading...</li>
          )}
        </ul>
        <button id="fullscreen-btn">⛶ FULLSCREEN</button>
        <div className="instructions">
          <h3>FLIGHT MANUAL</h3>
          <ul>
            <li>
              <span>ARROWS ↑ ↓ ← →</span> : NAVIGATE
            </li>
            <li>
              <span>SPACE</span> : FIRE CANNONS
            </li>
            <li>
              <span>P / ESC</span> : PAUSE GAME
            </li>
            <li>
              <span>Q</span> : QUIT MISSION
            </li>
          </ul>
        </div>
      </aside>

      <main id="game-container">
        <div id="login-screen" style={{ display: showLogin ? 'flex' : 'none' }}>
          <div className="glass-box">
            <h1 className="game-header">
              METEOR BLAST
              <span>PILOT REGISTRATION</span>
            </h1>
            <input
              type="text"
              id="player-initials"
              maxLength={20}
              autoComplete="off"
              placeholder="NICKNAME"
              autoFocus
            />
            <button id="start-btn" className="glass-button" onClick={startGame}>
              ENGAGE ENGINES
            </button>
          </div>
        </div>

        <div id="game-ui">
          <div className="score">Score: {score}</div>
          <div id="health-bar-container">
            <span id="shield-label">{shieldLabel}</span>
            <div id="health-bar-bg">
              <div
                id="health-bar-fill"
                style={{ width: `${health}%` }}
                className={healthBarClass}
              />
            </div>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          id="game-canvas"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />

        <div id="ui-container">
          <div
            id="joystick-base"
            ref={joystickBaseRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div id="joystick-stick" ref={joystickStickRef} />
          </div>
          <button
            id="mobile-fire-btn"
            onTouchStart={handleFireStart}
            onTouchEnd={handleFireEnd}
          >
            FIRE
          </button>
        </div>

        <button id="quit-btn" onClick={handleQuit}>
          QUIT MISSION
        </button>

        <div id="quit-modal" className={`modal-overlay ${showQuitModal ? 'active' : ''}`}>
          <div className="glass-modal">
            <h2>ABANDON MISSION?</h2>
            <p>Your current score will be lost.</p>
            <div className="modal-buttons">
              <button id="confirm-quit" className="modal-btn danger" onClick={confirmQuit}>
                ABANDON
              </button>
              <button id="cancel-quit" className="modal-btn" onClick={cancelQuit}>
                STAY
              </button>
            </div>
          </div>
        </div>

        <div id="loading-spinner" className={showLoading ? 'active' : ''}>
          <div className="radar" />
          <p>UPLOADING DATA...</p>
        </div>

        <div id="crt" />
        <div id="vignette" />
      </main>
    </div>
  );
}