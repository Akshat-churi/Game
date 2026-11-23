export type TimeOfDay = 'day' | 'night';
export type TrafficDensity = 'light' | 'medium' | 'rush';
export type CameraMode = 'chase' | 'cockpit';
export type GameScreen = 'title' | 'garage' | 'countdown' | 'racing' | 'paused' | 'finished';

export type BikeClassId = 'streetfighter' | 'superbike' | 'hypergp';
export type PaintFinish = 'gloss' | 'matte' | 'metallic';
export type ExhaustStyle = 'titanium' | 'carbon_dual' | 'gp_shorty';
export type UnderglowColor = 'none' | 'amber' | 'cyan' | 'crimson';
export type LeanStyle = 'touring' | 'sport' | 'track';
export type BrakeStyle = 'smooth' | 'balanced' | 'aggressive';

export interface UpgradeLevels {
  engine: number; // 1..5
  nitro: number; // 1..5
  suspension: number; // 1..5
  brakes: number; // 1..5
}

export interface HandlingTuning {
  steeringSensitivity: number; // 0.65..1.35
  leanStyle: LeanStyle;
  brakeStyle: BrakeStyle;
}

export interface BikeVisualConfig {
  bikeClass: BikeClassId;
  primaryColor: string;
  accentColor: string;
  rimColor: string;
  finish: PaintFinish;
  exhaust: ExhaustStyle;
  underglow: UnderglowColor;
}

export interface PlayerProfile {
  credits: number;
  bestTimeSec: number | null;
  racesCompleted: number;
  upgrades: UpgradeLevels;
  handling: HandlingTuning;
  visuals: BikeVisualConfig;
  timeOfDay: TimeOfDay;
  trafficDensity: TrafficDensity;
}

export interface RivalMarker {
  id: number;
  name: string;
  progress: number; // 0..1
  color: string;
}

export interface HudTelemetry {
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: number; // 1..6
  nitro: number; // 0..100
  isBoosting: boolean;
  progress: number; // 0..1
  distanceM: number;
  elapsedSec: number;
  position: number; // 1..4
  totalRacers: number;
  score: number;
  nearMissCount: number;
  nearMissCombo: number;
  nearMissBanner: string | null;
  landmarkName: string;
  countdownValue: number; // 3, 2, 1, 0
  topSpeedKmh: number;
  rivals: RivalMarker[];
  wrongWay: boolean;
  damageFlash: number; // 0..1
}

export interface RaceResult {
  position: number;
  totalRacers: number;
  finishTimeSec: number;
  topSpeedKmh: number;
  nearMissCount: number;
  score: number;
  creditsEarned: number;
  isNewBest: boolean;
}

export interface PaintSwatch {
  id: string;
  name: string;
  primary: string;
  accent: string;
}

export interface RimSwatch {
  id: string;
  name: string;
  color: string;
}

export interface BikeClassSpec {
  id: BikeClassId;
  name: string;
  displacement: string;
  speedBonus: number;
  handlingBonus: number;
  accelBonus: number;
}

export const BIKE_CLASSES: BikeClassSpec[] = [
  {
    id: 'streetfighter',
    name: 'Colaba 650R',
    displacement: '650cc Inline-4',
    speedBonus: 0,
    handlingBonus: 0.14,
    accelBonus: 0.08,
  },
  {
    id: 'superbike',
    name: 'Konkan 1000RR',
    displacement: '999cc Superbike',
    speedBonus: 16,
    handlingBonus: 0.04,
    accelBonus: 0.12,
  },
  {
    id: 'hypergp',
    name: 'Arabian GP-X',
    displacement: '1103cc V4 Aero',
    speedBonus: 28,
    handlingBonus: -0.02,
    accelBonus: 0.18,
  },
];

export const PAINT_SWATCHES: PaintSwatch[] = [
  { id: 'crimson', name: 'Konkan Crimson', primary: '#c81e2b', accent: '#f59e0b' },
  { id: 'cobalt', name: 'Arabian Cobalt', primary: '#1d4ed8', accent: '#38bdf8' },
  { id: 'obsidian', name: 'Monsoon Obsidian', primary: '#181c24', accent: '#f59e0b' },
  { id: 'gold', name: 'Nariman Gold', primary: '#d97706', accent: '#1e293b' },
  { id: 'pearl', name: 'Chowpatty Pearl', primary: '#e2e8f0', accent: '#dc2626' },
  { id: 'emerald', name: 'Malabar Emerald', primary: '#047857', accent: '#fbbf24' },
];

export const RIM_SWATCHES: RimSwatch[] = [
  { id: 'gold', name: 'Anodized Gold', color: '#eab308' },
  { id: 'crimson', name: 'Track Red', color: '#ef4444' },
  { id: 'carbon', name: 'Forged Carbon', color: '#1e2430' },
  { id: 'silver', name: 'Machined Alloy', color: '#cbd5e1' },
  { id: 'cyan', name: 'Coastal Cyan', color: '#06b6d4' },
];

export const UNDERGLOW_OPTIONS: { id: UnderglowColor; name: string; hex: string }[] = [
  { id: 'none', name: 'Off', hex: '#334155' },
  { id: 'amber', name: 'Necklace Gold', hex: '#f59e0b' },
  { id: 'cyan', name: 'Arabian Blue', hex: '#06b6d4' },
  { id: 'crimson', name: 'Brake Red', hex: '#ef4444' },
];

export const EXHAUST_OPTIONS: { id: ExhaustStyle; name: string }[] = [
  { id: 'titanium', name: 'Brushed Titanium' },
  { id: 'carbon_dual', name: 'Dual Carbon' },
  { id: 'gp_shorty', name: 'GP Shorty' },
];

export interface UpgradeSpec {
  key: keyof UpgradeLevels;
  label: string;
  subtitle: string;
  baseCost: number;
  stepCost: number;
}

export const UPGRADE_SPECS: UpgradeSpec[] = [
  {
    key: 'engine',
    label: 'ECU & Engine',
    subtitle: 'Top speed & torque delivery',
    baseCost: 850,
    stepCost: 650,
  },
  {
    key: 'nitro',
    label: 'Nitro Injection',
    subtitle: 'Boost thrust & recharge rate',
    baseCost: 750,
    stepCost: 550,
  },
  {
    key: 'suspension',
    label: 'Race Suspension',
    subtitle: 'Cornering grip & high-speed lean',
    baseCost: 700,
    stepCost: 500,
  },
  {
    key: 'brakes',
    label: 'Carbon Brakes & Slicks',
    subtitle: 'Stopping power & lane agility',
    baseCost: 650,
    stepCost: 500,
  },
];

export function getUpgradeCost(key: keyof UpgradeLevels, currentLevel: number): number {
  const spec = UPGRADE_SPECS.find((s) => s.key === key)!;
  return spec.baseCost + (currentLevel - 1) * spec.stepCost;
}

export interface ComputedBikeStats {
  topSpeedKmh: number;
  boostTopSpeedKmh: number;
  accelMps2: number;
  brakeMps2: number;
  lateralSpeed: number;
  nitroCapacity: number;
  nitroRechargeRate: number;
  maxLeanRad: number;
  leanDamp: number;
  // Normalized 0..100 for garage stat bars
  speedRating: number;
  accelRating: number;
  handlingRating: number;
  nitroRating: number;
}

export function computeBikeStats(
  upgrades: UpgradeLevels,
  handling: HandlingTuning,
  bikeClass: BikeClassId
): ComputedBikeStats {
  const cls = BIKE_CLASSES.find((c) => c.id === bikeClass) ?? BIKE_CLASSES[1];
  const topSpeedKmh = 195 + (upgrades.engine - 1) * 16 + cls.speedBonus;
  const boostBonusKmh = 56 + (upgrades.nitro - 1) * 10;
  const accelMps2 = (14.5 + (upgrades.engine - 1) * 2.1) * (1 + cls.accelBonus);
  const brakeMult =
    handling.brakeStyle === 'aggressive' ? 1.2 : handling.brakeStyle === 'smooth' ? 0.88 : 1.0;
  const brakeMps2 = (26 + (upgrades.brakes - 1) * 3.8) * brakeMult;

  const leanMult =
    handling.leanStyle === 'track' ? 1.18 : handling.leanStyle === 'touring' ? 0.85 : 1.0;
  const lateralSpeed =
    (9.2 + (upgrades.suspension - 1) * 1.15 + (upgrades.brakes - 1) * 0.45) *
    (1 + cls.handlingBonus) *
    handling.steeringSensitivity;

  const maxLeanRad = Math.min(0.82, (0.58 + (upgrades.suspension - 1) * 0.04) * leanMult);
  const leanDamp =
    handling.leanStyle === 'track' ? 12.5 : handling.leanStyle === 'touring' ? 7.0 : 9.5;

  const nitroCapacity = 100;
  const nitroRechargeRate = 4.2 + (upgrades.nitro - 1) * 1.4;

  return {
    topSpeedKmh,
    boostTopSpeedKmh: topSpeedKmh + boostBonusKmh,
    accelMps2,
    brakeMps2,
    lateralSpeed,
    nitroCapacity,
    nitroRechargeRate,
    maxLeanRad,
    leanDamp,
    speedRating: Math.min(100, Math.round(((topSpeedKmh - 190) / 145) * 100)),
    accelRating: Math.min(100, Math.round(((accelMps2 - 12) / 17) * 100)),
    handlingRating: Math.min(100, Math.round(((lateralSpeed - 6.5) / 12) * 100)),
    nitroRating: Math.min(100, Math.round((upgrades.nitro / 5) * 100)),
  };
}

export const DEFAULT_PROFILE: PlayerProfile = {
  credits: 2400,
  bestTimeSec: null,
  racesCompleted: 0,
  upgrades: {
    engine: 1,
    nitro: 1,
    suspension: 1,
    brakes: 1,
  },
  handling: {
    steeringSensitivity: 1.0,
    leanStyle: 'sport',
    brakeStyle: 'balanced',
  },
  visuals: {
    bikeClass: 'superbike',
    primaryColor: '#c81e2b',
    accentColor: '#f59e0b',
    rimColor: '#eab308',
    finish: 'gloss',
    exhaust: 'titanium',
    underglow: 'amber',
  },
  timeOfDay: 'night',
  trafficDensity: 'medium',
};

const STORAGE_KEY = 'marine_drive_gp_profile_v1';

export function loadProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      upgrades: { ...DEFAULT_PROFILE.upgrades, ...(parsed.upgrades ?? {}) },
      handling: { ...DEFAULT_PROFILE.handling, ...(parsed.handling ?? {}) },
      visuals: { ...DEFAULT_PROFILE.visuals, ...(parsed.visuals ?? {}) },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors in sandboxed frames
  }
}
