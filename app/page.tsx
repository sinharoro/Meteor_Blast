'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Star,
  Bullet,
  Enemy,
  BigEnemy,
  Particle,
  PowerUp,
  Score,
  SubweaponType,
  Subweapon,
  SUBWEAPONS
} from '../types/gameObjects';

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
  const [selectedSubweapon, setSelectedSubweapon] = useState<SubweaponType>('homing-missiles');
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [emergencyUsed, setEmergencyUsed] = useState(false);
  const [shieldLabel, setShieldLabel] = useState('SHIELD');
  const [healthBarClass, setHealthBarClass] = useState('');
  const [showSubweaponSelect, setShowSubweaponSelect] = useState(false);
  const [showChargeBtn, setShowChargeBtn] = useState(false);
  const [specialCharge, setSpecialCharge] = useState(0);

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
      subweapon: 'homing-missiles' as SubweaponType,
      subweaponCooldown: 0,
      subweaponLevel: 1,
    },
    specialCharge: 0,
    maxSpecialCharge: 100,
    isSpecialActive: false,
    specialTimer: 0,
    spriteCache: {} as Record<string, HTMLCanvasElement>,
    currentPlayerName: '',
    isGameOver: false,
    specialSkillActive: false,
    specialSkillTimer: 0,
    laserCharge: 0,
    laserBeam: { x: 0, y: 0, length: 0, width: 0, angle: 0, hitEnemies: new Set<string>() },
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

  const activateUltimate = useCallback(() => {
    const state = gameState.current;
    if (state.specialCharge < 100 || !state.running) return;
    
    state.specialCharge = 0;
    setSpecialCharge(0);
    setShowChargeBtn(false);
    state.shakeTimer = 20;
    state.isSpecialActive = true;
    state.specialTimer = 120;
    state.laserBeam.hitEnemies.clear();
  }, []);

  const activateSpecialSkill = useCallback(() => {
    const state = gameState.current;
    if (state.charge < 100 || state.specialSkillActive) return;
    
    state.specialSkillActive = true;
    state.specialSkillTimer = 180;
    state.shakeTimer = 20;
    state.charge = 0;
    setCharge(0);
    setShowChargeBtn(false);
    state.laserBeam.hitEnemies.clear();
  }, []);

  const updateLaserBeam = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = gameState.current;
    const player = state.player;
    
    if (!state.specialSkillActive) return;
    
    state.specialSkillTimer--;
    
    const progress = 1 - (state.specialSkillTimer / 90);
    const beamLength = 50 + progress * (CANVAS_WIDTH - player.x);
    const baseWidth = 8;
    const beamWidth = baseWidth + progress * 40;
    
    const centerY = player.y + player.h / 2;
    
    ctx.save();
    
    for (let i = 0; i < 3; i++) {
      const layerWidth = beamWidth * (1 - i * 0.25);
      const alpha = 0.15 - i * 0.04;
      
      ctx.globalAlpha = alpha + Math.random() * 0.1;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ffff';
      
      const gradient = ctx.createLinearGradient(player.x + player.w, centerY, player.x + player.w + beamLength, centerY);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.2, '#00ffff');
      gradient.addColorStop(0.5, '#00aaff');
      gradient.addColorStop(0.8, '#0066ff');
      gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = gradient;
      
      ctx.fillRect(player.x + player.w, centerY - layerWidth / 2, beamLength, layerWidth);
    }
    
    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ffffff';
    const coreGradient = ctx.createLinearGradient(player.x + player.w, centerY, player.x + player.w + beamLength, centerY);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, '#aaffff');
    coreGradient.addColorStop(1, '#00ffff');
    ctx.fillStyle = coreGradient;
    ctx.fillRect(player.x + player.w, centerY - baseWidth / 2, beamLength, baseWidth);
    
    for (let j = 0; j < 5; j++) {
      const sparkX = player.x + player.w + Math.random() * beamLength;
      const sparkY = centerY + (Math.random() - 0.5) * beamWidth * 0.8;
      ctx.globalAlpha = Math.random() * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, Math.random() * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const en = state.enemies[i];
      const enemyCenterY = en.y + en.h / 2;
      const enemyRight = en.x + en.w;
      const enemyLeft = en.x;
      const beamRight = player.x + player.w + beamLength;
      
      if (enemyRight > player.x + player.w && enemyLeft < beamRight) {
        if (Math.abs(enemyCenterY - centerY) < beamWidth / 2 + en.h / 2) {
          createExplosion(en.x + en.w / 2, en.y + en.h / 2, '#00ffff', 15);
          state.enemies.splice(i, 1);
          setScore((s) => s + 15);
        }
      }
    }
    
    for (let i = state.bigenemies.length - 1; i >= 0; i--) {
      const ben = state.bigenemies[i];
      const enemyCenterY = ben.y + ben.h / 2;
      const enemyRight = ben.x + ben.w;
      const enemyLeft = ben.x;
      const beamRight = player.x + player.w + beamLength;
      
      if (enemyRight > player.x + player.w && enemyLeft < beamRight) {
        if (Math.abs(enemyCenterY - centerY) < beamWidth / 2 + ben.h / 2) {
          createExplosion(ben.x + ben.w / 2, ben.y + ben.h / 2, '#00aaff', 20);
          ben.hp -= 2;
          state.shakeTimer = 5;
          if (ben.hp <= 0) {
            createExplosion(ben.x + ben.w / 2, ben.y + ben.h / 2, '#ff4444', 30);
            state.bigenemies.splice(i, 1);
            setScore((s) => s + 150);
          }
        }
      }
    }
    
    if (state.specialSkillTimer <= 0) {
      state.specialSkillActive = false;
    }
  }, [createExplosion]);

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

    const currentFireRate = player.isRapidFiring ? 45 : FIRE_RATE;
    if (state.keys['Space'] && Date.now() - state.lastFireTime > currentFireRate) {
      if (player.isRapidFiring) {
        state.bullets.push({ x: player.x + player.w, y: player.y + 5, r: 4, speed: 14, color: '#ff3333', trail: [] });
        state.bullets.push({ x: player.x + player.w, y: player.y + player.h - 5, r: 4, speed: 14, color: '#ff3333', trail: [] });
      } else {
        const bulletColors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00'];
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2,
          r: 5,
          speed: 14,
          color: bulletColors[Math.floor(Math.random() * bulletColors.length)],
          trail: []
        });
      }
      state.lastFireTime = Date.now();
    }

    if (player.subweaponCooldown > 0) {
      player.subweaponCooldown--;
    }

    if (state.keys['Space'] && player.subweaponCooldown === 0 && player.subweaponLevel > 0) {
      const subweaponType = player.subweapon;
      if (subweaponType === 'homing-missiles') {
        const allTargets = [...state.enemies, ...state.bigenemies];
        if (allTargets.length > 0) {
          const target = allTargets[Math.floor(Math.random() * allTargets.length)];
          const angle = Math.atan2((target.y + target.h / 2) - (player.y + player.h / 2), (target.x + target.w / 2) - (player.x + player.w));
          state.bullets.push({
            x: player.x + player.w,
            y: player.y + player.h / 2,
            r: 6,
            speed: 10,
            color: '#ff6600',
            trail: [],
            isSubweapon: true,
            subweaponType: 'homing-missiles',
            target,
            angle
          });
        } else {
          state.bullets.push({
            x: player.x + player.w,
            y: player.y + player.h / 2,
            r: 6,
            speed: 10,
            color: '#ff6600',
            trail: [],
            isSubweapon: true,
            subweaponType: 'homing-missiles'
          });
        }
        player.subweaponCooldown = 25;
      } else if (subweaponType === 'search-laser') {
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 - 8,
          r: 4,
          speed: 18,
          color: '#00ffaa',
          trail: [],
          isSubweapon: true,
          subweaponType: 'search-laser'
        });
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 + 8,
          r: 4,
          speed: 18,
          color: '#00ffaa',
          trail: [],
          isSubweapon: true,
          subweaponType: 'search-laser'
        });
        player.subweaponCooldown = 15;
      } else if (subweaponType === 'plasma-mines') {
        state.bullets.push({
          x: player.x + player.w / 2,
          y: player.y,
          r: 12,
          speed: 2,
          color: '#aa44ff',
          trail: [],
          isSubweapon: true,
          subweaponType: 'plasma-mines'
        });
        player.subweaponCooldown = 60;
      } else if (subweaponType === 'seeking-wingmen') {
        for (let i = -1; i <= 1; i++) {
          state.bullets.push({
            x: player.x + player.w,
            y: player.y + player.h / 2 + i * 15,
            r: 5,
            speed: 12,
            color: '#ffff00',
            trail: [],
            isSubweapon: true,
            subweaponType: 'seeking-wingmen'
          });
        }
        player.subweaponCooldown = 20;
      } else if (subweaponType === 'heat-missiles') {
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 - 5,
          r: 5,
          speed: 16,
          color: '#ff3300',
          trail: [],
          isSubweapon: true,
          subweaponType: 'heat-missiles'
        });
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 + 5,
          r: 5,
          speed: 16,
          color: '#ff3300',
          trail: [],
          isSubweapon: true,
          subweaponType: 'heat-missiles'
        });
        player.subweaponCooldown = 18;
      } else if (subweaponType === 'napalm') {
        const zigzag = Math.random() > 0.5 ? 1 : -1;
        state.bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2,
          r: 8,
          speed: 8,
          color: '#ff4400',
          trail: [],
          isSubweapon: true,
          subweaponType: 'napalm',
          angle: zigzag * 0.3
        });
        player.subweaponCooldown = 30;
      }
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      if (b.isSubweapon && b.subweaponType) {
        if (b.subweaponType === 'homing-missiles' && b.target) {
          const tx = b.target.x + b.target.w / 2;
          const ty = b.target.y + b.target.h / 2;
          if (b.target.hp <= 0) {
            const allTargets = [...state.enemies, ...state.bigenemies].filter(e => e.hp > 0);
            if (allTargets.length > 0) {
              b.target = allTargets[Math.floor(Math.random() * allTargets.length)];
            } else {
              b.speed = 14;
            }
          } else {
            const targetAngle = Math.atan2(ty - b.y, tx - b.x);
            const currentAngle = b.angle || 0;
            const newAngle = currentAngle + (targetAngle - currentAngle) * 0.1;
            b.angle = newAngle;
            b.speedX = Math.cos(newAngle) * 10;
            b.speedY = Math.sin(newAngle) * 10;
            b.x += Math.cos(newAngle) * 10;
            b.y += Math.sin(newAngle) * 10;
            continue;
          }
        } else if (b.subweaponType === 'napalm') {
          b.y += Math.sin(b.angle || 0) * 3;
          b.angle = -(b.angle || 0);
        } else if (b.subweaponType === 'search-laser') {
          b.r = 4;
        } else if (b.subweaponType === 'plasma-mines') {
          b.speed = Math.max(0, b.speed - 0.1);
          if (b.speed < 0.5) b.speed = 0;
          if (b.speed === 0 && b.r < 30) b.r += 0.5;
        }
      }
      b.x += b.speed;
      if (b.x > CANVAS_WIDTH + 50 || b.x < -50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) {
        state.bullets.splice(i, 1);
        continue;
      }
      if (b.isSubweapon && b.subweaponType === 'plasma-mines' && b.speed === 0) {
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const en = state.enemies[j];
          const dx = b.x - (en.x + en.w / 2);
          const dy = b.y - (en.y + en.h / 2);
          if (Math.sqrt(dx * dx + dy * dy) < b.r + 20) {
            createExplosion(en.x + 15, en.y + 15, '#aa44ff', 10);
            state.enemies.splice(j, 1);
            setScore(s => s + 15);
          }
        }
        for (let j = state.bigenemies.length - 1; j >= 0; j--) {
          const ben = state.bigenemies[j];
          const dx = b.x - (ben.x + ben.w / 2);
          const dy = b.y - (ben.y + ben.h / 2);
          if (Math.sqrt(dx * dx + dy * dy) < b.r + 30) {
            createExplosion(ben.x + 30, ben.y + 30, '#aa44ff', 15);
            ben.hp -= 2;
            if (ben.hp <= 0) {
              createExplosion(ben.x + 30, ben.y + 30, 'red', 25);
              state.bigenemies.splice(j, 1);
              setScore(s => s + 150);
            }
          }
        }
        if (b.r >= 30) state.bullets.splice(i, 1);
      }
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
        } else if (pu.type === 'subweapon') {
          player.subweaponLevel = Math.min(player.subweaponLevel + 1, 3);
          setScore((s) => s + 100);
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
          if (state.specialCharge < 100) {
            state.specialCharge = Math.min(state.specialCharge + 1, 100);
            setSpecialCharge(state.specialCharge);
            if (state.specialCharge >= 100) setShowChargeBtn(true);
          }
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
          if (state.specialCharge < 100) {
            state.specialCharge = Math.min(state.specialCharge + 2, 100);
            setSpecialCharge(state.specialCharge);
            if (state.specialCharge >= 100) setShowChargeBtn(true);
          }
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

    if (state.isSpecialActive) {
      state.specialTimer--;
      if (state.specialTimer <= 0) {
        state.isSpecialActive = false;
      }
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
        else if (pu.type === 'subweapon') emoji = '🚀';

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

      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00d4ff';
      ctx.fillStyle = Math.random() > 0.5 ? '#88ddff' : '#66ccff';
      ctx.beginPath();
      ctx.moveTo(-player.w / 2, -5);
      ctx.lineTo(-player.w / 2 - (10 + Math.random() * 8), 0);
      ctx.lineTo(-player.w / 2, 5);
      ctx.fill();
      ctx.restore();

      if (player.health > 25 && !player.emergencyUsed) {
        ctx.save();
        const shieldGlow = player.health / 250;
        const time = Date.now() / 1000;
        const gradient = ctx.createRadialGradient(0, 0, 20, 0, 0, 50);
        gradient.addColorStop(0, `rgba(0, 255, 255, ${shieldGlow * 0.3})`);
        gradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + shieldGlow * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -time * 20;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      ctx.shadowBlur = player.isRapidFiring ? 25 : 8;
      ctx.shadowColor = player.isRapidFiring ? '#ff4400' : '#00ffff';

      const shipGradient = ctx.createLinearGradient(-25, 0, 25, 0);
      shipGradient.addColorStop(0, '#0066aa');
      shipGradient.addColorStop(0.5, '#00ddff');
      shipGradient.addColorStop(1, '#00ffff');
      ctx.fillStyle = shipGradient;
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(-15, -12);
      ctx.lineTo(-25, -18);
      ctx.lineTo(-20, -8);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.lineTo(-20, 8);
      ctx.lineTo(-25, 18);
      ctx.lineTo(-15, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#003366';
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      const cockpitGradient = ctx.createRadialGradient(15, 0, 0, 15, 0, 8);
      cockpitGradient.addColorStop(0, '#ffffff');
      cockpitGradient.addColorStop(0.3, '#00ffff');
      cockpitGradient.addColorStop(1, '#0066aa');
      ctx.fillStyle = cockpitGradient;
      ctx.beginPath();
      ctx.ellipse(12, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, -2);
      ctx.lineTo(-8, -7);
      ctx.moveTo(22, 2);
      ctx.lineTo(-8, 7);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const engineGlow = Math.sin(Date.now() / 100) * 0.3 + 0.7;
      const engineColors = player.isRapidFiring 
        ? ['#ff6600', '#ff3300', '#ffff00'] 
        : ['#00ffff', '#0088ff', '#ffffff'];
      
      for (let i = 0; i < 3; i++) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = engineColors[i];
        ctx.fillStyle = engineColors[i];
        const offsetY = (i - 1) * 4;
        const flameLen = 10 + Math.random() * 15 + (player.isRapidFiring ? 10 : 0);
        ctx.beginPath();
        ctx.moveTo(-25, offsetY - 2);
        ctx.lineTo(-25 - flameLen, offsetY);
        ctx.lineTo(-25, offsetY + 2);
        ctx.closePath();
        ctx.globalAlpha = engineGlow;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(-8, -12, 20, 3);
      ctx.fillRect(-8, 9, 20, 3);
      ctx.restore();

      ctx.restore();

      state.bullets.forEach((b) => {
        ctx.save();
        const trailLen = b.trail.length;
        for (let i = 0; i < trailLen; i++) {
          const t = b.trail[i];
          const alpha = (trailLen - i) / trailLen;
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(t.x, t.y, b.r * alpha * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.shadowBlur = 12;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

      // Draw special laser beam (Z key)
      if (state.isSpecialActive) {
        ctx.save();
        const centerY = player.y + player.h / 2;
        const beamY = centerY;
        const shipNoseX = player.x + player.w;
        const laserWidth = player.h * 3;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FFFF';
        
        ctx.fillStyle = '#00BFFF';
        ctx.beginPath();
        ctx.arc(shipNoseX, beamY, laserWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 120;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(shipNoseX, beamY);
        ctx.lineTo(CANVAS_WIDTH, beamY);
        ctx.stroke();
        ctx.closePath();
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 50;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(shipNoseX, beamY);
        ctx.lineTo(CANVAS_WIDTH, beamY);
        ctx.stroke();
        ctx.closePath();
        
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 10;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(shipNoseX, beamY);
        ctx.lineTo(CANVAS_WIDTH, beamY);
        ctx.stroke();
        ctx.closePath();
        
        ctx.restore();
        
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const en = state.enemies[i];
          const enemyCenterY = en.y + en.h / 2;
          if (Math.abs(enemyCenterY - centerY) < 65 && en.x > player.x) {
            createExplosion(en.x + en.w / 2, en.y + en.h / 2, '#00BFFF', 12);
            state.enemies.splice(i, 1);
            setScore((s) => s + 10);
          }
        }
        for (let i = state.bigenemies.length - 1; i >= 0; i--) {
          const ben = state.bigenemies[i];
          const benCenterY = ben.y + ben.h / 2;
          if (Math.abs(benCenterY - centerY) < 75 && ben.x > player.x) {
            createExplosion(ben.x + ben.w / 2, ben.y + ben.h / 2, '#00BFFF', 15);
            state.bigenemies.splice(i, 1);
            setScore((s) => s + 100);
          }
        }
      }

      // Draw emergency shockwave
      if (state.shockwaveActive) {
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = Math.max(0, 1 - state.shockwaveRadius / 500);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, state.shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, Math.max(0, state.shockwaveRadius - 20), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw search laser beam (1945 style)
      if (state.specialSkillActive) {
        updateLaserBeam(ctx);
      }
    }
    ctx.restore();
  }, [getEmojiSprite, updateLaserBeam]);

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
      if (e.code === 'Digit1' && gameState.current.running && gameState.current.specialCharge >= 100) {
        activateUltimate();
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
  }, [initStars, activateUltimate]);

  useEffect(() => {
    if (!showLogin && !showSubweaponSelect) {
      gameState.current.running = true;
    } else {
      gameState.current.running = false;
    }
  }, [showLogin, showSubweaponSelect]);

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
  }, [updateGame, drawGame, updateLaserBeam]);

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
    state.player.subweaponLevel = 1;
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
    setShowSubweaponSelect(false);
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
            <span id="health-percent" className={healthBarClass}>{Math.round(health)}%</span>
          </div>
          <div id="charge-bar-container">
            <span id="charge-label">SPECIAL</span>
            <div id="charge-bar-bg">
              <div id="charge-bar-fill" style={{ width: `${(specialCharge / 100) * 80}px` }} />
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
          <button
            id="special-btn"
            className={showChargeBtn ? 'ready' : ''}
            onTouchStart={() => showChargeBtn && activateSpecialSkill()}
            style={{ display: showChargeBtn ? 'block' : 'none' }}
          >
            SPECIAL {Math.round(specialCharge)}%
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
