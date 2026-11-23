import * as THREE from 'three';
import type { BikeVisualConfig, UnderglowColor } from './types';

export interface SportbikeRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  riderGroup: THREE.Group;
  headlightSpot: THREE.SpotLight | null;
  headlightBeamCone: THREE.Mesh;
  nitroFlames: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  underglowMesh: THREE.Mesh;
  underglowMat: THREE.MeshBasicMaterial;
  cockpitAnchor: THREE.Object3D;
  applyVisuals: (config: BikeVisualConfig) => void;
  setNightMode: (isNight: boolean) => void;
  setBraking: (braking: boolean) => void;
  setBoosting: (boosting: boolean, pulse: number) => void;
  spinWheels: (distanceDelta: number) => void;
}

const UNDERGLOW_HEX: Record<UnderglowColor, string> = {
  none: '#000000',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  crimson: '#ef4444',
};

/**
 * Builds a high-fidelity composite procedural 3D Sportbike + Articulated Rider
 * (18+ sculpted parts with MeshPhysicalMaterial clearcoat paint, anodized forks,
 * spoked brake-rotor wheels, carbon trim, customizable exhausts, underglow,
 * and glowing LED lighting). Grounded at bottom-center (y = 0).
 */
export function createSportbikeRig(
  initialConfig: BikeVisualConfig,
  tireTreadTex: THREE.CanvasTexture,
  contactShadowTex: THREE.CanvasTexture,
  haloTex: THREE.CanvasTexture,
  withSpotLight: boolean
): SportbikeRig {
  const root = new THREE.Group();
  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  // Soft radial contact shadow grounded on asphalt
  const shadowGeo = new THREE.PlaneGeometry(1.55, 2.85);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);

  // Customizable Underglow reflection plane on asphalt
  const underglowGeo = new THREE.PlaneGeometry(2.1, 3.1);
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    map: haloTex,
    color: new THREE.Color('#f59e0b'),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.y = 0.032;
  root.add(underglowMesh);

  // Core shared PBR materials (updated live on customization)
  const bodyPaintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialConfig.primaryColor),
    metalness: 0.45,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const accentPaintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialConfig.accentColor),
    metalness: 0.55,
    roughness: 0.24,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#171b24',
    metalness: 0.35,
    roughness: 0.42,
  });

  const chassisMetalMat = new THREE.MeshStandardMaterial({
    color: '#343c4c',
    metalness: 0.86,
    roughness: 0.28,
  });

  const forkGoldMat = new THREE.MeshPhysicalMaterial({
    color: '#d4a12a',
    metalness: 0.94,
    roughness: 0.18,
    anisotropy: 0.7,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialConfig.rimColor),
    metalness: 0.85,
    roughness: 0.22,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: '#1b1d22',
    map: tireTreadTex,
    roughness: 0.86,
    metalness: 0.05,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    metalness: 0.92,
    roughness: 0.24,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    metalness: 0.1,
    roughness: 0.06,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    emissive: new THREE.Color('#fff5dc'),
    emissiveIntensity: 3.2,
    roughness: 0.1,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: '#7f1d1d',
    emissive: new THREE.Color('#ff1e2d'),
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });

  // Helper to build a detailed sportbike wheel (tire + anodized rim + 5 spokes + twin brake rotors)
  const buildWheel = (radius: number, width: number): THREE.Group => {
    const wg = new THREE.Group();

    const tireGeo = new THREE.TorusGeometry(radius - 0.065, 0.072, 14, 28);
    tireGeo.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.scale.set(width / 0.145, 1, 1);
    tire.castShadow = true;
    wg.add(tire);

    const rimRingGeo = new THREE.TorusGeometry(radius - 0.125, 0.022, 10, 24);
    rimRingGeo.rotateY(Math.PI / 2);
    const rimRing = new THREE.Mesh(rimRingGeo, rimMat);
    wg.add(rimRing);

    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, width * 0.82, 12);
    hubGeo.rotateZ(Math.PI / 2);
    wg.add(new THREE.Mesh(hubGeo, chassisMetalMat));

    // 5 Y-spokes
    const spokeGeo = new THREE.BoxGeometry(0.024, radius * 1.16, 0.032);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.x = (i / 5) * Math.PI;
      wg.add(spoke);
    }

    // Twin stainless brake discs
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.012, 20);
    rotorGeo.rotateZ(Math.PI / 2);
    const rLeft = new THREE.Mesh(rotorGeo, rotorMat);
    rLeft.position.x = -width * 0.42;
    const rRight = new THREE.Mesh(rotorGeo, rotorMat);
    rRight.position.x = width * 0.42;
    wg.add(rLeft, rRight);

    return wg;
  };

  // Wheels positioned along Z (-Z is forward!)
  const frontWheel = buildWheel(0.32, 0.13);
  frontWheel.position.set(0, 0.32, -0.76);
  leanGroup.add(frontWheel);

  const rearWheel = buildWheel(0.33, 0.19);
  rearWheel.position.set(0, 0.33, 0.72);
  leanGroup.add(rearWheel);

  // Swingarm & Chain Guard
  const swingarmGeo = new THREE.BoxGeometry(0.28, 0.085, 0.62);
  const swingarm = new THREE.Mesh(swingarmGeo, chassisMetalMat);
  swingarm.position.set(0, 0.36, 0.46);
  swingarm.rotation.x = -0.14;
  leanGroup.add(swingarm);

  // Sculpted Engine Block & Underbelly Pan
  const engineGeo = new THREE.BoxGeometry(0.38, 0.38, 0.58);
  const engine = new THREE.Mesh(engineGeo, chassisMetalMat);
  engine.position.set(0, 0.46, -0.02);
  engine.castShadow = true;
  leanGroup.add(engine);

  const bellyPanGeo = new THREE.BoxGeometry(0.41, 0.16, 0.78);
  const bellyPan = new THREE.Mesh(bellyPanGeo, carbonMat);
  bellyPan.position.set(0, 0.29, -0.08);
  bellyPan.rotation.x = 0.08;
  leanGroup.add(bellyPan);

  // Main Sculpted Aerodynamic Side Fairing (Extruded silhouette)
  const fairingShape = new THREE.Shape();
  fairingShape.moveTo(-0.55, 0.32);
  fairingShape.lineTo(0.28, 0.28);
  fairingShape.lineTo(0.48, 0.62);
  fairingShape.lineTo(0.84, 0.72);
  fairingShape.lineTo(0.76, 0.96);
  fairingShape.lineTo(0.18, 1.02);
  fairingShape.lineTo(-0.32, 0.84);
  fairingShape.closePath();

  const fairingGeo = new THREE.ExtrudeGeometry(fairingShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 3,
  });
  fairingGeo.center();
  fairingGeo.rotateY(Math.PI / 2); // align profile with -Z forward
  const mainFairing = new THREE.Mesh(fairingGeo, bodyPaintMat);
  mainFairing.position.set(0, 0.66, -0.14);
  mainFairing.castShadow = true;
  leanGroup.add(mainFairing);

  // Racing Stripe Accent Side Blades
  const bladeGeo = new THREE.BoxGeometry(0.51, 0.1, 0.88);
  const sideBlade = new THREE.Mesh(bladeGeo, accentPaintMat);
  sideBlade.position.set(0, 0.66, -0.22);
  sideBlade.rotation.x = 0.16;
  leanGroup.add(sideBlade);

  // Hyper-GP Aero Winglets (toggled by bike class)
  const wingletGroup = new THREE.Group();
  const wingGeo = new THREE.BoxGeometry(0.86, 0.035, 0.22);
  const wingMesh = new THREE.Mesh(wingGeo, carbonMat);
  wingMesh.position.set(0, 0.74, -0.66);
  wingMesh.rotation.x = 0.18;
  wingletGroup.add(wingMesh);

  const wingTipGeo = new THREE.BoxGeometry(0.03, 0.12, 0.22);
  const wtL = new THREE.Mesh(wingTipGeo, accentPaintMat);
  wtL.position.set(-0.42, 0.78, -0.66);
  const wtR = new THREE.Mesh(wingTipGeo, accentPaintMat);
  wtR.position.set(0.42, 0.78, -0.66);
  wingletGroup.add(wtL, wtR);
  leanGroup.add(wingletGroup);

  // Sculpted Fuel Tank
  const tankGeo = new THREE.BoxGeometry(0.42, 0.26, 0.56);
  const tank = new THREE.Mesh(tankGeo, bodyPaintMat);
  tank.position.set(0, 0.92, -0.12);
  tank.rotation.x = 0.14;
  tank.castShadow = true;
  leanGroup.add(tank);

  // Sharp Supersport Tail Cowl
  const tailGeo = new THREE.BoxGeometry(0.32, 0.16, 0.76);
  const tailCowl = new THREE.Mesh(tailGeo, bodyPaintMat);
  tailCowl.position.set(0, 0.92, 0.64);
  tailCowl.rotation.x = 0.28;
  tailCowl.castShadow = true;
  leanGroup.add(tailCowl);

  // Rider Seat Pad
  const seatGeo = new THREE.BoxGeometry(0.3, 0.08, 0.42);
  const seat = new THREE.Mesh(seatGeo, carbonMat);
  seat.position.set(0, 0.84, 0.26);
  seat.rotation.x = 0.06;
  leanGroup.add(seat);

  // Anodized USD Twin Front Forks
  const forkGeo = new THREE.CylinderGeometry(0.026, 0.023, 0.76, 10);
  const forkL = new THREE.Mesh(forkGeo, forkGoldMat);
  forkL.position.set(-0.12, 0.62, -0.66);
  forkL.rotation.x = -0.34;
  const forkR = new THREE.Mesh(forkGeo, forkGoldMat);
  forkR.position.set(0.12, 0.62, -0.66);
  forkR.rotation.x = -0.34;
  leanGroup.add(forkL, forkR);

  // Clip-on Handlebars & Digital TFT Dash (visible in Cockpit Cam!)
  const barGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8);
  barGeo.rotateZ(Math.PI / 2);
  const handleBar = new THREE.Mesh(barGeo, chassisMetalMat);
  handleBar.position.set(0, 0.94, -0.5);
  leanGroup.add(handleBar);

  const dashGeo = new THREE.BoxGeometry(0.22, 0.09, 0.04);
  const dashMat = new THREE.MeshStandardMaterial({
    color: '#0b1220',
    emissive: new THREE.Color('#0ea5e9'),
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(0, 1.0, -0.58);
  dash.rotation.x = -0.55;
  leanGroup.add(dash);

  // Aerodynamic Tinted Windscreen
  const screenGeo = new THREE.BoxGeometry(0.36, 0.28, 0.03);
  const windscreen = new THREE.Mesh(screenGeo, glassMat);
  windscreen.position.set(0, 1.08, -0.68);
  windscreen.rotation.x = -0.82;
  leanGroup.add(windscreen);

  // Dual Razor LED Projector Headlights
  const hlGeo = new THREE.BoxGeometry(0.13, 0.055, 0.06);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.12, 0.82, -0.84);
  hlL.rotation.y = 0.22;
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.12, 0.82, -0.84);
  hlR.rotation.y = -0.22;
  leanGroup.add(hlL, hlR);

  // Subtle volumetric headlight beam cone (visible at night)
  const coneGeo = new THREE.ConeGeometry(1.9, 13.5, 16, 1, true);
  coneGeo.rotateX(Math.PI / 2);
  coneGeo.translate(0, 0, -6.75);
  const coneMat = new THREE.MeshBasicMaterial({
    color: '#fff3d1',
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const headlightBeamCone = new THREE.Mesh(coneGeo, coneMat);
  headlightBeamCone.position.set(0, 0.78, -0.85);
  headlightBeamCone.rotation.x = -0.09;
  leanGroup.add(headlightBeamCone);

  // Real SpotLight for player bike illuminating wet coastal asphalt at night
  let headlightSpot: THREE.SpotLight | null = null;
  if (withSpotLight) {
    headlightSpot = new THREE.SpotLight(0xfff0cc, 32, 65, Math.PI / 5.2, 0.55, 1.5);
    headlightSpot.position.set(0, 0.88, -0.82);
    headlightSpot.target.position.set(0, 0.1, -24);
    leanGroup.add(headlightSpot);
    leanGroup.add(headlightSpot.target);
  }

  // Razor Rear LED Brake / Tail Light
  const tailLightGeo = new THREE.BoxGeometry(0.24, 0.045, 0.05);
  const tailLight = new THREE.Mesh(tailLightGeo, brakeLightMat);
  tailLight.position.set(0, 1.0, 0.99);
  leanGroup.add(tailLight);

  // Customizable Exhaust Variants (3 distinct styles toggled on config change)
  const exhaustTitanium = new THREE.Group();
  const exhaustCarbonDual = new THREE.Group();
  const exhaustGpShorty = new THREE.Group();

  const tiMat = new THREE.MeshPhysicalMaterial({
    color: '#cbd5e1',
    metalness: 0.94,
    roughness: 0.18,
    anisotropy: 0.8,
  });

  // Style 1: Brushed Titanium Side Canister
  const tiPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.044, 0.68, 12), tiMat);
  tiPipe.rotation.x = Math.PI / 2 - 0.25;
  tiPipe.position.set(0.24, 0.44, 0.54);
  const tiTip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.1, 12), carbonMat);
  tiTip.rotation.x = Math.PI / 2 - 0.25;
  tiTip.position.set(0.24, 0.52, 0.88);
  exhaustTitanium.add(tiPipe, tiTip);

  // Style 2: Dual Carbon Under-Tail Exhausts
  [-0.1, 0.1].forEach((exX) => {
    const cPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.54, 12), carbonMat);
    cPipe.rotation.x = Math.PI / 2 - 0.22;
    cPipe.position.set(exX, 0.84, 0.82);
    exhaustCarbonDual.add(cPipe);
  });

  // Style 3: MotoGP Shorty Megaphone
  const gpPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.036, 0.42, 12), forkGoldMat);
  gpPipe.rotation.x = Math.PI / 2 - 0.35;
  gpPipe.position.set(0.24, 0.36, 0.36);
  exhaustGpShorty.add(gpPipe);

  leanGroup.add(exhaustTitanium, exhaustCarbonDual, exhaustGpShorty);

  // Nitro Afterburner Flame Cones (appear when boosting)
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(0.07, 0.58, 10);
  flameGeo.rotateX(Math.PI / 2);
  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.position.set(0.24, 0.52, 1.18);
  flameRight.visible = false;
  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.1, 0.88, 1.24);
  flameLeft.visible = false;
  leanGroup.add(flameRight, flameLeft);
  const nitroFlames = [flameRight, flameLeft];

  // Articulated Tucked-in Sportbike Rider
  const riderGroup = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({
    color: '#141821',
    roughness: 0.62,
    metalness: 0.12,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    metalness: 0.9,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  // Torso (tucked aerodynamic race crouch)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.52), suitMat);
  torso.position.set(0, 1.12, 0.08);
  torso.rotation.x = 0.42;
  torso.castShadow = true;
  riderGroup.add(torso);

  // Racing hump on back matching accent color
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), accentPaintMat);
  hump.position.set(0, 1.24, 0.12);
  hump.rotation.x = 0.35;
  riderGroup.add(hump);

  // Helmet + Tinted Visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), bodyPaintMat);
  helmet.scale.set(0.95, 0.98, 1.14);
  helmet.position.set(0, 1.32, -0.22);
  helmet.castShadow = true;
  riderGroup.add(helmet);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.148, 14, 10, -0.9, 1.8, 0.9, 0.85), visorMat);
  visor.position.set(0, 1.32, -0.25);
  visor.rotation.y = Math.PI;
  riderGroup.add(visor);

  // Arms reaching forward to clip-ons
  const armGeo = new THREE.CylinderGeometry(0.048, 0.042, 0.46, 8);
  [-0.22, 0.22].forEach((ax) => {
    const arm = new THREE.Mesh(armGeo, suitMat);
    arm.position.set(ax, 1.06, -0.24);
    arm.rotation.x = Math.PI / 2 - 0.38;
    arm.rotation.z = ax < 0 ? 0.22 : -0.22;
    riderGroup.add(arm);
  });

  // Legs tucked against fuel tank & rearsets
  const legGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.52, 8);
  [-0.2, 0.2].forEach((lx) => {
    const leg = new THREE.Mesh(legGeo, suitMat);
    leg.position.set(lx, 0.72, 0.24);
    leg.rotation.x = -0.58;
    riderGroup.add(leg);
  });

  leanGroup.add(riderGroup);

  // Cockpit Camera Anchor (just above windscreen looking down Marine Drive)
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 1.26, -0.34);
  leanGroup.add(cockpitAnchor);

  let currentNight = true;
  let currentExhaust = initialConfig.exhaust;

  const applyVisuals = (cfg: BikeVisualConfig) => {
    currentExhaust = cfg.exhaust;
    bodyPaintMat.color.set(cfg.primaryColor);
    accentPaintMat.color.set(cfg.accentColor);
    rimMat.color.set(cfg.rimColor);

    if (cfg.finish === 'matte') {
      bodyPaintMat.metalness = 0.15;
      bodyPaintMat.roughness = 0.64;
      bodyPaintMat.clearcoat = 0.05;
    } else if (cfg.finish === 'metallic') {
      bodyPaintMat.metalness = 0.88;
      bodyPaintMat.roughness = 0.16;
      bodyPaintMat.clearcoat = 1.0;
      bodyPaintMat.clearcoatRoughness = 0.05;
    } else {
      // gloss clearcoat
      bodyPaintMat.metalness = 0.42;
      bodyPaintMat.roughness = 0.22;
      bodyPaintMat.clearcoat = 1.0;
      bodyPaintMat.clearcoatRoughness = 0.08;
    }

    // Class silhouette tweaks
    wingletGroup.visible = cfg.bikeClass === 'hypergp';
    windscreen.scale.set(
      cfg.bikeClass === 'streetfighter' ? 0.75 : 1.0,
      cfg.bikeClass === 'streetfighter' ? 0.65 : 1.0,
      1.0
    );
    mainFairing.scale.set(
      cfg.bikeClass === 'streetfighter' ? 0.88 : cfg.bikeClass === 'hypergp' ? 1.08 : 1.0,
      1.0,
      cfg.bikeClass === 'hypergp' ? 1.06 : 1.0
    );

    // Exhaust visibility
    exhaustTitanium.visible = cfg.exhaust === 'titanium';
    exhaustCarbonDual.visible = cfg.exhaust === 'carbon_dual';
    exhaustGpShorty.visible = cfg.exhaust === 'gp_shorty';

    // Underglow color & intensity
    if (cfg.underglow === 'none') {
      underglowMesh.visible = false;
    } else {
      underglowMesh.visible = true;
      underglowMat.color.set(UNDERGLOW_HEX[cfg.underglow]);
      underglowMat.opacity = currentNight ? 0.68 : 0.18;
    }
  };

  const setNightMode = (isNight: boolean) => {
    currentNight = isNight;
    headlightMat.emissiveIntensity = isNight ? 4.2 : 1.3;
    headlightBeamCone.visible = isNight;
    if (headlightSpot) {
      headlightSpot.intensity = isNight ? 38 : 0;
    }
    if (underglowMesh.visible) {
      underglowMat.opacity = isNight ? 0.68 : 0.18;
    }
  };

  const setBraking = (braking: boolean) => {
    brakeLightMat.emissiveIntensity = braking ? 5.2 : currentNight ? 2.2 : 0.9;
  };

  const setBoosting = (boosting: boolean, pulse: number) => {
    if (!boosting) {
      flameRight.visible = false;
      flameLeft.visible = false;
      return;
    }
    const scaleLen = 0.85 + Math.sin(pulse * 48) * 0.25;
    if (currentExhaust === 'carbon_dual') {
      flameRight.visible = true;
      flameLeft.visible = true;
      flameRight.position.set(0.1, 0.88, 1.22);
      flameLeft.position.set(-0.1, 0.88, 1.22);
    } else if (currentExhaust === 'gp_shorty') {
      flameRight.visible = true;
      flameLeft.visible = false;
      flameRight.position.set(0.24, 0.42, 0.72);
    } else {
      flameRight.visible = true;
      flameLeft.visible = false;
      flameRight.position.set(0.24, 0.54, 1.16);
    }
    flameRight.scale.set(1, 1, scaleLen);
    flameLeft.scale.set(1, 1, scaleLen);
  };

  const spinWheels = (distanceDelta: number) => {
    // Rotating around local X moves forward along -Z
    const angle = -distanceDelta / 0.32;
    frontWheel.rotation.x += angle;
    rearWheel.rotation.x += angle * 0.97;
  };

  applyVisuals(initialConfig);
  setNightMode(true);

  return {
    root,
    leanGroup,
    frontWheel,
    rearWheel,
    riderGroup,
    headlightSpot,
    headlightBeamCone,
    nitroFlames,
    brakeLightMat,
    underglowMesh,
    underglowMat,
    cockpitAnchor,
    applyVisuals,
    setNightMode,
    setBraking,
    setBoosting,
    spinWheels,
  };
}
