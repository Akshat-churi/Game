import * as THREE from 'three';

/**
 * Marine Drive Coastal Boulevard Spline:
 * Nariman Point (s = 0m) -> Girgaon Chowpatty (s = 3600m)
 *
 * Authentic Back Bay orientation:
 * Heading north along Marine Drive, the Arabian Sea lies on the LEFT (-u),
 * the Art Deco heritage skyline lies on the RIGHT (+u), and the road curves
 * gracefully LEFT (counter-clockwise) around Back Bay toward Girgaon Chowpatty
 * and Malabar Hill so the player sees the iconic glowing "Queen's Necklace" arc
 * curving ahead across the water!
 */
export const TRACK_LENGTH = 3600;
export const TRACK_START_BUFFER = -120;
export const TRACK_END_BUFFER = 3840;
export const ROAD_HALF_WIDTH = 8.4; // 16.8m total 4-lane boulevard
export const LANE_CENTERS = [-5.8, -2.0, 2.0, 5.8] as const;

// Radius of the sweeping Back Bay C-curve (in meters)
const BASE_RADIUS = 1950;

export interface LandmarkZone {
  startS: number;
  endS: number;
  name: string;
  shortLabel: string;
}

export const LANDMARK_ZONES: LandmarkZone[] = [
  { startS: -200, endS: 500, name: 'Nariman Point · Air India & Oberoi', shortLabel: 'Nariman Pt' },
  { startS: 500, endS: 1450, name: 'Marine Drive · Art Deco Promenade', shortLabel: 'Art Deco Mile' },
  { startS: 1450, endS: 2150, name: 'Marine Lines · Gymkhanas & Wankhede', shortLabel: 'Marine Lines' },
  { startS: 2150, endS: 2950, name: 'Taraporewala · Queen’s Necklace Curve', shortLabel: 'Charni Rd' },
  { startS: 2950, endS: 4000, name: 'Girgaon Chowpatty · Malabar Hill', shortLabel: 'Chowpatty' },
];

export function getLandmarkAt(s: number): LandmarkZone {
  for (let i = 0; i < LANDMARK_ZONES.length; i++) {
    const z = LANDMARK_ZONES[i];
    if (s >= z.startS && s < z.endS) return z;
  }
  return LANDMARK_ZONES[LANDMARK_ZONES.length - 1];
}

/**
 * Computes exact center-line position, unit forward tangent, and unit right vector
 * at arc-length `s` (meters from Nariman Point). Zero heap allocations!
 *
 * Coordinate convention:
 * - At s = 0: position = (0, 0, 0), forward = (0, 0, -1), right = (1, 0, 0)
 * - As s increases: curve arcs gently leftward (-X, -Z) around center (-BASE_RADIUS, 0, 0)
 *   with a subtle coastal S-undulation for exciting high-speed bike leaning.
 */
export function sampleTrack(
  s: number,
  outPos: THREE.Vector3,
  outTangent: THREE.Vector3,
  outRight: THREE.Vector3
): void {
  const theta = s / BASE_RADIUS; // 0 -> ~1.85 rad (~106 deg C-curve)
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Subtle organic coastal radius undulation (gentle real-road sweep)
  const wavePhase = s * 0.0042;
  const dr = Math.sin(wavePhase) * 28.0 + Math.sin(s * 0.0017) * 18.0;
  const drDs =
    Math.cos(wavePhase) * 28.0 * 0.0042 + Math.cos(s * 0.0017) * 18.0 * 0.0017;

  const r = BASE_RADIUS + dr;

  // Center of Back Bay arc is at (-BASE_RADIUS, 0, 0)
  const cx = -BASE_RADIUS + r * cosT;
  const cz = -r * sinT;

  // Derivative with respect to s:
  // dx/ds = dr/ds * cosT - r * sinT / BASE_RADIUS
  // dz/ds = -dr/ds * sinT - r * cosT / BASE_RADIUS
  const tx = drDs * cosT - (r * sinT) / BASE_RADIUS;
  const tz = -drDs * sinT - (r * cosT) / BASE_RADIUS;
  const invLen = 1 / Math.hypot(tx, tz);

  outPos.set(cx, 0, cz);
  outTangent.set(tx * invLen, 0, tz * invLen);
  // Right vector = tangent x up(0,1,0) = (-tz, 0, tx)
  outRight.set(-outTangent.z, 0, outTangent.x);
}

/**
 * Helper to place a world point at (s, lateralOffset u, height y)
 */
const _tmpPos = new THREE.Vector3();
const _tmpTan = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();

export function trackToWorld(
  s: number,
  u: number,
  y: number,
  out: THREE.Vector3
): THREE.Vector3 {
  sampleTrack(s, _tmpPos, _tmpTan, _tmpRight);
  out.set(
    _tmpPos.x + _tmpRight.x * u,
    y,
    _tmpPos.z + _tmpRight.z * u
  );
  return out;
}

/**
 * Returns heading yaw angle (rotation.y for Three.js objects facing -Z locally)
 */
export function getTrackYaw(tangent: THREE.Vector3): number {
  return Math.atan2(-tangent.x, -tangent.z);
}

/**
 * Precomputed normalized 2D minimap points for the curved Marine Drive SVG HUD
 */
export interface MinimapPoint {
  x: number;
  y: number;
}

export function generateMinimapPoints(samples = 48): MinimapPoint[] {
  const raw: { x: number; z: number }[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const s = (i / samples) * TRACK_LENGTH;
    sampleTrack(s, _tmpPos, _tmpTan, _tmpRight);
    raw.push({ x: _tmpPos.x, z: _tmpPos.z });
    if (_tmpPos.x < minX) minX = _tmpPos.x;
    if (_tmpPos.x > maxX) maxX = _tmpPos.x;
    if (_tmpPos.z < minZ) minZ = _tmpPos.z;
    if (_tmpPos.z > maxZ) maxZ = _tmpPos.z;
  }

  const span = Math.max(maxX - minX, maxZ - minZ) || 1;
  const pad = 12;
  const size = 100 - pad * 2;
  const offsetX = (size - ((maxX - minX) / span) * size) * 0.5;
  const offsetY = (size - ((maxZ - minZ) / span) * size) * 0.5;

  return raw.map((p) => ({
    x: pad + offsetX + ((p.x - minX) / span) * size,
    y: pad + offsetY + ((p.z - minZ) / span) * size,
  }));
}
