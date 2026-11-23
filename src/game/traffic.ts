import * as THREE from 'three';
import { createSportbikeRig, type SportbikeRig } from './bikeModel';
import { getTrackYaw, LANE_CENTERS, sampleTrack, TRACK_LENGTH } from './track';
import type { BikeVisualConfig, RivalMarker, TrafficDensity } from './types';

export type TrafficKind = 'kaali_peeli' | 'best_bus' | 'auto' | 'sedan';

export interface TrafficVehicle {
  group: THREE.Group;
  kind: TrafficKind;
  s: number;
  u: number;
  laneIndex: number;
  targetLaneIndex: number;
  speedMps: number;
  halfWidth: number;
  halfLength: number;
  nearMissed: boolean;
  laneChangeTimer: number;
  blinkerLeft: THREE.Mesh;
  blinkerRight: THREE.Mesh;
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  interiorMat?: THREE.MeshStandardMaterial;
}

export interface RivalRacer {
  id: number;
  name: string;
  color: string;
  rig: SportbikeRig;
  s: number;
  u: number;
  targetU: number;
  speedMps: number;
  basePaceKmh: number;
  leanAngle: number;
  laneTimer: number;
}

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * Builds composite multi-part Mumbai coastal traffic vehicles:
 * - Kaali-Peeli Taxi (iconic black body + yellow top & bumper stripe)
 * - BEST Red Double-Decker Bus (iconic tall Mumbai scarlet bus)
 * - Mumbai Auto-Rickshaw (black & yellow 3-wheeler with curved canopy)
 * - Coastal Commuter Sedan
 */
function buildMumbaiVehicle(
  kind: TrafficKind,
  contactShadowTex: THREE.CanvasTexture
): Omit<TrafficVehicle, 's' | 'u' | 'laneIndex' | 'targetLaneIndex' | 'speedMps' | 'nearMissed' | 'laneChangeTimer'> {
  const group = new THREE.Group();

  const wheelMat = new THREE.MeshStandardMaterial({ color: '#17191f', roughness: 0.88, metalness: 0.08 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#1b283b', roughness: 0.14, metalness: 0.55 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.2, metalness: 0.9 });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#fff9e6',
    emissive: new THREE.Color('#ffebb3'),
    emissiveIntensity: 2.6,
    roughness: 0.12,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: '#7f1d1d',
    emissive: new THREE.Color('#ff1f2d'),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const blinkerMatL = new THREE.MeshStandardMaterial({
    color: '#b45309',
    emissive: new THREE.Color('#f59e0b'),
    emissiveIntensity: 0.2,
  });
  const blinkerMatR = blinkerMatL.clone();

  let halfWidth = 0.95;
  let halfLength = 2.15;
  let interiorMat: THREE.MeshStandardMaterial | undefined;

  const addWheel = (x: number, y: number, z: number, r: number, w: number) => {
    const wg = new THREE.CylinderGeometry(r, r, w, 12);
    wg.rotateZ(Math.PI / 2);
    const wm = new THREE.Mesh(wg, wheelMat);
    wm.position.set(x, y, z);
    group.add(wm);
  };

  if (kind === 'kaali_peeli') {
    halfWidth = 0.92;
    halfLength = 2.05;

    const blackMat = new THREE.MeshPhysicalMaterial({
      color: '#14171f',
      roughness: 0.28,
      metalness: 0.35,
      clearcoat: 0.8,
    });
    const yellowMat = new THREE.MeshPhysicalMaterial({
      color: '#facc15',
      roughness: 0.26,
      metalness: 0.22,
      clearcoat: 0.85,
    });

    // Lower body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.72, 3.95), blackMat);
    body.position.set(0, 0.68, 0);
    body.castShadow = true;
    group.add(body);

    // Classic yellow belt stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.77, 0.14, 3.98), yellowMat);
    stripe.position.set(0, 0.62, 0);
    group.add(stripe);

    // Iconic Yellow Cabin Roof
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.56, 2.05), yellowMat);
    cabin.position.set(0, 1.32, 0.1);
    cabin.castShadow = true;
    group.add(cabin);

    // Cabin windows band
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.36, 1.88), glassMat);
    win.position.set(0, 1.28, 0.1);
    group.add(win);

    // Roof TAXI sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.18), headlightMat);
    sign.position.set(0, 1.66, -0.1);
    group.add(sign);

    // Chrome bumpers
    const bFront = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.12), chromeMat);
    bFront.position.set(0, 0.4, -2.0);
    const bRear = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.12), chromeMat);
    bRear.position.set(0, 0.4, 2.0);
    group.add(bFront, bRear);

    addWheel(-0.84, 0.34, -1.25, 0.34, 0.22);
    addWheel(0.84, 0.34, -1.25, 0.34, 0.22);
    addWheel(-0.84, 0.34, 1.25, 0.34, 0.22);
    addWheel(0.84, 0.34, 1.25, 0.34, 0.22);
  } else if (kind === 'best_bus') {
    halfWidth = 1.26;
    halfLength = 4.65;

    const redMat = new THREE.MeshPhysicalMaterial({
      color: '#c81e2b',
      roughness: 0.34,
      metalness: 0.22,
      clearcoat: 0.65,
    });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#f4ebd4', roughness: 0.45 });
    interiorMat = new THREE.MeshStandardMaterial({
      color: '#29374a',
      emissive: new THREE.Color('#ffda91'),
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    // Tall BEST Double-Decker Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.44, 3.65, 9.1), redMat);
    hull.position.set(0, 2.28, 0);
    hull.castShadow = true;
    group.add(hull);

    // Iconic cream horizontal stripe between decks
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.22, 9.14), creamMat);
    belt.position.set(0, 2.34, 0);
    group.add(belt);

    // Upper & Lower illuminated passenger deck windows
    const lowWin = new THREE.Mesh(new THREE.BoxGeometry(2.47, 0.72, 8.2), interiorMat);
    lowWin.position.set(0, 1.66, 0.1);
    const upWin = new THREE.Mesh(new THREE.BoxGeometry(2.47, 0.74, 8.3), interiorMat);
    upWin.position.set(0, 3.18, 0.05);
    group.add(lowWin, upWin);

    // Front destination LED board
    const destBoard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.26, 0.06), headlightMat);
    destBoard.position.set(0, 3.84, -4.56);
    group.add(destBoard);

    addWheel(-1.14, 0.52, -2.9, 0.52, 0.32);
    addWheel(1.14, 0.52, -2.9, 0.52, 0.32);
    addWheel(-1.14, 0.52, 2.8, 0.52, 0.36);
    addWheel(1.14, 0.52, 2.8, 0.52, 0.36);
  } else if (kind === 'auto') {
    halfWidth = 0.72;
    halfLength = 1.38;

    const autoBlack = new THREE.MeshStandardMaterial({ color: '#151821', roughness: 0.38, metalness: 0.25 });
    const autoYellow = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.42, metalness: 0.12 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#1c1f26', roughness: 0.85 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.72, 2.45), autoBlack);
    base.position.set(0, 0.62, 0.05);
    base.castShadow = true;
    group.add(base);

    const lowerYellow = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 2.48), autoYellow);
    lowerYellow.position.set(0, 0.44, 0.05);
    group.add(lowerYellow);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 2.0), canopyMat);
    canopy.position.set(0, 1.32, 0.16);
    canopy.castShadow = true;
    group.add(canopy);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.48, 0.08), glassMat);
    windshield.position.set(0, 1.18, -0.94);
    windshield.rotation.x = -0.22;
    group.add(windshield);

    // Iconic 3 wheels (1 front, 2 rear)
    addWheel(0, 0.26, -1.0, 0.26, 0.15);
    addWheel(-0.62, 0.26, 0.82, 0.26, 0.16);
    addWheel(0.62, 0.26, 0.82, 0.26, 0.16);
  } else {
    // Modern Mumbai Coastal Sedan
    halfWidth = 0.96;
    halfLength = 2.28;
    const colors = ['#d8dee9', '#475569', '#1e3a5f', '#64748b', '#7c2d12'];
    const bodyCol = colors[Math.floor(Math.random() * colors.length)];
    const paintMat = new THREE.MeshPhysicalMaterial({
      color: bodyCol,
      roughness: 0.22,
      metalness: 0.55,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.68, 4.42), paintMat);
    chassis.position.set(0, 0.64, 0);
    chassis.castShadow = true;
    group.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.54, 2.25), paintMat);
    cabin.position.set(0, 1.24, 0.12);
    cabin.castShadow = true;
    group.add(cabin);

    const win = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.36, 2.08), glassMat);
    win.position.set(0, 1.22, 0.12);
    group.add(win);

    addWheel(-0.88, 0.35, -1.35, 0.35, 0.23);
    addWheel(0.88, 0.35, -1.35, 0.35, 0.23);
    addWheel(-0.88, 0.35, 1.35, 0.35, 0.23);
    addWheel(0.88, 0.35, 1.35, 0.35, 0.23);
  }

  // Headlights & Taillights
  const hlW = kind === 'auto' ? 0.24 : 0.34;
  const hlY = kind === 'best_bus' ? 0.92 : 0.72;
  const zFront = -halfLength;
  const zRear = halfLength;

  if (kind === 'auto') {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.08), headlightMat);
    hl.position.set(0, 0.68, zFront - 0.01);
    group.add(hl);
  } else {
    [-halfWidth * 0.66, halfWidth * 0.66].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(hlW, 0.18, 0.08), headlightMat);
      hl.position.set(lx, hlY, zFront - 0.01);
      group.add(hl);
    });
  }

  [-halfWidth * 0.64, halfWidth * 0.64].forEach((lx) => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(hlW * 0.9, 0.16, 0.08), taillightMat);
    tl.position.set(lx, hlY + 0.04, zRear + 0.01);
    group.add(tl);
  });

  // Lane-change Telegraph Blinkers (amber rear corner indicators)
  const blinkerGeo = new THREE.BoxGeometry(0.18, 0.16, 0.1);
  const blinkerLeft = new THREE.Mesh(blinkerGeo, blinkerMatL);
  blinkerLeft.position.set(-halfWidth * 0.88, hlY + 0.04, zRear + 0.02);
  const blinkerRight = new THREE.Mesh(blinkerGeo, blinkerMatR);
  blinkerRight.position.set(halfWidth * 0.88, hlY + 0.04, zRear + 0.02);
  group.add(blinkerLeft, blinkerRight);

  // Ground contact shadow
  const shGeo = new THREE.PlaneGeometry(halfWidth * 2.5, halfLength * 2.35);
  shGeo.rotateX(-Math.PI / 2);
  const shMesh = new THREE.Mesh(
    shGeo,
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    })
  );
  shMesh.position.y = 0.02;
  group.add(shMesh);

  return {
    group,
    kind,
    halfWidth,
    halfLength,
    blinkerLeft,
    blinkerRight,
    headlightMat,
    taillightMat,
    interiorMat,
  };
}

export class TrafficAndRivalsManager {
  public readonly group = new THREE.Group();
  public readonly vehicles: TrafficVehicle[] = [];
  public readonly rivals: RivalRacer[] = [];

  private density: TrafficDensity = 'medium';
  private isNight = true;

  constructor(
    tireTreadTex: THREE.CanvasTexture,
    contactShadowTex: THREE.CanvasTexture,
    haloTex: THREE.CanvasTexture
  ) {
    // Pool 28 coastal Mumbai vehicles (activated based on selected Traffic Density)
    const kinds: TrafficKind[] = [
      'kaali_peeli',
      'kaali_peeli',
      'sedan',
      'best_bus',
      'kaali_peeli',
      'auto',
      'sedan',
    ];

    for (let i = 0; i < 28; i++) {
      const kind = kinds[i % kinds.length];
      const built = buildMumbaiVehicle(kind, contactShadowTex);
      const laneIndex = kind === 'auto' ? 3 : i % 4;
      const v: TrafficVehicle = {
        ...built,
        s: -500,
        u: LANE_CENTERS[laneIndex],
        laneIndex,
        targetLaneIndex: laneIndex,
        speedMps: 14,
        nearMissed: false,
        laneChangeTimer: 3 + Math.random() * 5,
      };
      this.vehicles.push(v);
      this.group.add(v.group);
    }

    // Create 3 Competitive AI Rival Sportbike Racers
    const rivalConfigs: { name: string; paceKmh: number; visual: BikeVisualConfig }[] = [
      {
        name: 'Aarav · Worli Apex',
        paceKmh: 214,
        visual: {
          bikeClass: 'superbike',
          primaryColor: '#0284c7',
          accentColor: '#38bdf8',
          rimColor: '#cbd5e1',
          finish: 'gloss',
          exhaust: 'titanium',
          underglow: 'cyan',
        },
      },
      {
        name: 'Zoya · Bandra GP',
        paceKmh: 228,
        visual: {
          bikeClass: 'hypergp',
          primaryColor: '#eab308',
          accentColor: '#0f172a',
          rimColor: '#1e2430',
          finish: 'metallic',
          exhaust: 'carbon_dual',
          underglow: 'amber',
        },
      },
      {
        name: 'Kabir · Colaba RS',
        paceKmh: 202,
        visual: {
          bikeClass: 'streetfighter',
          primaryColor: '#059669',
          accentColor: '#fbbf24',
          rimColor: '#eab308',
          finish: 'matte',
          exhaust: 'gp_shorty',
          underglow: 'none',
        },
      },
    ];

    rivalConfigs.forEach((rc, idx) => {
      const rig = createSportbikeRig(rc.visual, tireTreadTex, contactShadowTex, haloTex, false);
      this.rivals.push({
        id: idx + 1,
        name: rc.name,
        color: rc.visual.primaryColor,
        rig,
        s: 6 + idx * 3,
        u: LANE_CENTERS[idx === 0 ? 0 : idx === 1 ? 1 : 3],
        targetU: LANE_CENTERS[idx === 0 ? 0 : idx === 1 ? 1 : 3],
        speedMps: 0,
        basePaceKmh: rc.paceKmh,
        leanAngle: 0,
        laneTimer: 1.5 + idx * 0.9,
      });
      this.group.add(rig.root);
    });
  }

  public setDensity(density: TrafficDensity): void {
    this.density = density;
  }

  public setTimeOfDay(isNight: boolean): void {
    this.isNight = isNight;
    for (const v of this.vehicles) {
      v.headlightMat.emissiveIntensity = isNight ? 3.2 : 0.4;
      v.taillightMat.emissiveIntensity = isNight ? 2.8 : 0.7;
      if (v.interiorMat) {
        v.interiorMat.emissiveIntensity = isNight ? 1.8 : 0.1;
      }
    }
    for (const r of this.rivals) {
      r.rig.setNightMode(isNight);
    }
  }

  private getActiveVehicleCount(): number {
    if (this.density === 'light') return 11;
    if (this.density === 'rush') return 26;
    return 18;
  }

  public resetForRace(): void {
    const activeCount = this.getActiveVehicleCount();
    const spacing = this.density === 'rush' ? 38 : this.density === 'light' ? 76 : 52;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (i >= activeCount) {
        v.group.visible = false;
        v.s = -999;
        continue;
      }
      v.group.visible = true;
      v.s = 95 + i * spacing + Math.random() * 20;
      const lane = v.kind === 'auto' ? 3 : Math.floor(Math.random() * 4);
      v.laneIndex = lane;
      v.targetLaneIndex = lane;
      v.u = LANE_CENTERS[lane];
      v.speedMps = this.pickSpeedFor(v.kind, lane);
      v.nearMissed = false;
      v.laneChangeTimer = 2.5 + Math.random() * 5;
      this.syncVehicleTransform(v);
    }

    // Place rivals cleanly on starting grid near Nariman Point
    const gridOffsets = [
      { s: 5, u: -2.0 },
      { s: 8, u: 5.4 },
      { s: 3, u: -5.4 },
    ];
    this.rivals.forEach((r, idx) => {
      r.s = gridOffsets[idx].s;
      r.u = gridOffsets[idx].u;
      r.targetU = r.u;
      r.speedMps = 0;
      r.leanAngle = 0;
      r.laneTimer = 1.5 + idx * 0.7;
      this.syncRivalTransform(r);
    });
  }

  private pickSpeedFor(kind: TrafficKind, lane: number): number {
    // Inner lanes (0, 1) flow slightly faster than outer promenade/curb lanes
    const laneBoost = lane === 1 || lane === 2 ? 1.15 : 0.92;
    if (kind === 'best_bus') return (13 + Math.random() * 4) * laneBoost;
    if (kind === 'auto') return 12 + Math.random() * 3.5;
    if (kind === 'kaali_peeli') return (17 + Math.random() * 6) * laneBoost;
    return (21 + Math.random() * 8) * laneBoost;
  }

  private syncVehicleTransform(v: TrafficVehicle): void {
    sampleTrack(v.s, _pos, _tan, _right);
    v.group.position.set(
      _pos.x + _right.x * v.u,
      0,
      _pos.z + _right.z * v.u
    );
    v.group.rotation.y = getTrackYaw(_tan);
  }

  private syncRivalTransform(r: RivalRacer): void {
    sampleTrack(r.s, _pos, _tan, _right);
    r.rig.root.position.set(
      _pos.x + _right.x * r.u,
      0,
      _pos.z + _right.z * r.u
    );
    r.rig.root.rotation.y = getTrackYaw(_tan);
    r.rig.leanGroup.rotation.z = r.leanAngle;
  }

  public update(
    dt: number,
    elapsed: number,
    playerS: number,
    raceActive: boolean
  ): void {
    const activeCount = this.getActiveVehicleCount();
    const recycleSpan = this.density === 'rush' ? 420 : this.density === 'light' ? 560 : 480;
    const blinkOn = Math.floor(elapsed * 6) % 2 === 0;

    // 1. Update Mumbai Traffic Vehicles
    for (let i = 0; i < activeCount; i++) {
      const v = this.vehicles[i];
      if (!v.group.visible) continue;

      v.s += v.speedMps * dt;

      // Recycle vehicles that fell behind player ahead into the horizon (up to Finish line)
      if (raceActive && v.s < playerS - 45 && playerS < TRACK_LENGTH - 180) {
        let newS = playerS + 190 + Math.random() * (recycleSpan - 170);
        if (newS > TRACK_LENGTH - 55) newS = TRACK_LENGTH - 60;
        // Avoid overlapping another vehicle in same lane
        const lane = v.kind === 'auto' ? 3 : Math.floor(Math.random() * 4);
        let clear = true;
        for (let j = 0; j < activeCount; j++) {
          if (i === j) continue;
          const o = this.vehicles[j];
          if (o.laneIndex === lane && Math.abs(o.s - newS) < 28) {
            clear = false;
            break;
          }
        }
        if (clear) {
          v.s = newS;
          v.laneIndex = lane;
          v.targetLaneIndex = lane;
          v.u = LANE_CENTERS[lane];
          v.speedMps = this.pickSpeedFor(v.kind, lane);
          v.nearMissed = false;
        }
      }

      // Smooth telegraphed lane changes (never change lanes right next to player)
      v.laneChangeTimer -= dt;
      if (v.laneChangeTimer <= 0 && v.kind !== 'best_bus' && v.kind !== 'auto') {
        v.laneChangeTimer = 4.2 + Math.random() * 4.5;
        if (v.s > playerS + 38 && v.s < playerS + 160) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const cand = THREE.MathUtils.clamp(v.laneIndex + dir, 0, 3);
          if (cand !== v.laneIndex) {
            // Ensure target lane is empty
            let safe = true;
            for (let j = 0; j < activeCount; j++) {
              if (j === i) continue;
              const o = this.vehicles[j];
              if (
                (o.laneIndex === cand || o.targetLaneIndex === cand) &&
                Math.abs(o.s - v.s) < 26
              ) {
                safe = false;
                break;
              }
            }
            if (safe) {
              v.targetLaneIndex = cand;
            }
          }
        }
      }

      const targetU = LANE_CENTERS[v.targetLaneIndex];
      const deltaU = targetU - v.u;
      if (Math.abs(deltaU) > 0.06) {
        const step = Math.sign(deltaU) * Math.min(Math.abs(deltaU), 2.3 * dt);
        v.u += step;
        const leftMat = v.blinkerLeft.material as THREE.MeshStandardMaterial;
        const rightMat = v.blinkerRight.material as THREE.MeshStandardMaterial;
        leftMat.emissiveIntensity = deltaU < 0 && blinkOn ? 5.0 : 0.15;
        rightMat.emissiveIntensity = deltaU > 0 && blinkOn ? 5.0 : 0.15;
      } else {
        v.laneIndex = v.targetLaneIndex;
        (v.blinkerLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        (v.blinkerRight.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
      }

      this.syncVehicleTransform(v);
    }

    // 2. Update AI Rival Sportbikes
    for (const r of this.rivals) {
      if (!raceActive) {
        this.syncRivalTransform(r);
        continue;
      }

      // Rubber-banding keeps coastal racing tight & thrilling without feeling unfair
      const distGap = playerS - r.s;
      const rubberAdjust = THREE.MathUtils.clamp(distGap * 0.22, -26, 36);
      const targetSpeedMps = Math.max(36, (r.basePaceKmh + rubberAdjust) / 3.6);
      const accel = r.speedMps < targetSpeedMps ? 16 : -14;
      r.speedMps = THREE.MathUtils.clamp(r.speedMps + accel * dt, 0, targetSpeedMps + 8);

      const ds = r.speedMps * dt;
      r.s = Math.min(TRACK_LENGTH + 110, r.s + ds);
      r.rig.spinWheels(ds);

      // Obstacle avoidance steering around Mumbai traffic
      r.laneTimer -= dt;
      let blocked = false;
      for (let i = 0; i < activeCount; i++) {
        const v = this.vehicles[i];
        if (!v.group.visible) continue;
        const ahead = v.s - r.s;
        if (ahead > 0 && ahead < 44 && Math.abs(v.u - r.u) < v.halfWidth + 1.15) {
          blocked = true;
          break;
        }
      }

      if (blocked || r.laneTimer <= 0) {
        r.laneTimer = 1.6 + Math.random() * 2.2;
        // Pick clearest lane
        let bestU = r.targetU;
        let bestScore = -999;
        for (let li = 0; li < LANE_CENTERS.length; li++) {
          const candU = LANE_CENTERS[li];
          let minAhead = 120;
          for (let i = 0; i < activeCount; i++) {
            const v = this.vehicles[i];
            if (!v.group.visible) continue;
            const ahead = v.s - r.s;
            if (ahead > -4 && ahead < minAhead && Math.abs(v.u - candU) < v.halfWidth + 1.0) {
              minAhead = ahead;
            }
          }
          const score = minAhead - Math.abs(candU - r.u) * 2.5;
          if (score > bestScore) {
            bestScore = score;
            bestU = candU;
          }
        }
        r.targetU = bestU;
      }

      const latDelta = r.targetU - r.u;
      const latVel = THREE.MathUtils.clamp(latDelta * 3.8, -8.5, 8.5);
      r.u += latVel * dt;

      // Dynamic corner + lane-change lean
      const targetLean = THREE.MathUtils.clamp(-latVel * 0.065 + 0.08, -0.58, 0.58);
      r.leanAngle = THREE.MathUtils.damp(r.leanAngle, targetLean, 8.5, dt);
      r.rig.setBoosting(rubberAdjust > 18 && r.speedMps > 52, elapsed);

      this.syncRivalTransform(r);
    }
  }

  public getRivalMarkers(): RivalMarker[] {
    return this.rivals.map((r) => ({
      id: r.id,
      name: r.name,
      progress: THREE.MathUtils.clamp(r.s / TRACK_LENGTH, 0, 1),
      color: r.color,
    }));
  }

  public getPlayerPosition(playerS: number): number {
    let pos = 1;
    for (const r of this.rivals) {
      if (r.s > playerS) pos++;
    }
    return pos;
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  }
}
