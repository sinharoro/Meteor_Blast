export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export interface Bullet {
  x: number;
  y: number;
  r: number;
  speed: number;
  speedX?: number;
  speedY?: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
  isSubweapon?: boolean;
  subweaponType?: SubweaponType;
  target?: Enemy | BigEnemy;
  angle?: number;
}

export interface Enemy {
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

export interface BigEnemy extends Enemy {
  hp: number;
}

export interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  life: number;
  decay: number;
}

export interface PowerUp {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  speed: number;
  subweaponType?: SubweaponType;
}

export interface Score {
  name: string;
  score: number;
}

export type SubweaponType = 
  'homing-missiles' | 
  'search-laser' | 
  'plasma-mines' | 
  'seeking-wingmen' | 
  'heat-missiles' | 
  'napalm';

export interface Subweapon {
  id: SubweaponType;
  name: string;
  description: string;
  emoji: string;
}

export const SUBWEAPONS: Subweapon[] = [
  { id: 'homing-missiles', name: 'Homing Missiles', description: 'Auto-target enemies', emoji: '🎯' },
  { id: 'search-laser', name: 'Search Laser', description: 'Piercing laser', emoji: '⚡' },
  { id: 'plasma-mines', name: 'Plasma Mines', description: 'Bullet shield', emoji: '💠' },
  { id: 'seeking-wingmen', name: 'Seeking Wingmen', description: 'Attack drones', emoji: '🛸' },
  { id: 'heat-missiles', name: 'Heat Missiles', description: 'Piercing missiles', emoji: '🔥' },
  { id: 'napalm', name: 'Napalm Bombs', description: 'Zigzag flames', emoji: '💥' },
];
