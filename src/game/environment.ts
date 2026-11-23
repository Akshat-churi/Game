import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProceduralTexturePack } from './textures';
import {
  getTrackYaw,
  ROAD_HALF_WIDTH,
  sampleTrack,
  TRACK_END_BUFFER,
  TRACK_LENGTH,
  TRACK_START_BUFFER,
} from './track';
import type { TimeOfDay } from './types';

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Helper to create a curved ribbon BufferGeometry following the Marine Drive spline
 */
function buildCurvedRibbon(
  sStart: number,
  sEnd: number,
  uLeft: number,
  uRight: number,
  yLeft: number,
  yRight: number,
  segments: number,
  uvVScale: number
): THREE.BufferGeometry {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const s = sStart + t * (sEnd - sStart);
    sampleTrack(s, _pos, _tan, _right);

    const base = i * 2;
    positions[base * 3] = _pos.x + _right.x * uLeft;
    positions[base * 3 + 1] = yLeft;
    positions[base * 3 + 2] = _pos.z + _right.z * uLeft;

    positions[(base + 1) * 3] = _pos.x + _right.x * uRight;
    positions[(base + 1) * 3 + 1] = yRight;
    positions[(base + 1) * 3 + 2] = _pos.z + _right.z * uRight;

    const v = (s - sStart) * uvVScale;
    uvs[base * 2] = 0;
    uvs[base * 2 + 1] = v;
    uvs[(base + 1) * 2] = 1;
    uvs[(base + 1) * 2 + 1] = v;

    if (i < segments) {
      const a = base;
      const b = base + 1;
      const c = base + 2;
      const d = base + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an authentic 4-legged Mumbai concrete coastal Tetrapod geometry
 */
function buildTetrapodGeometry(): THREE.BufferGeometry {
  const dirs = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0.9428, -0.3333, 0),
    new THREE.Vector3(-0.4714, -0.3333, 0.8165),
    new THREE.Vector3(-0.4714, -0.3333, -0.8165),
  ];

  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();

  for (const dir of dirs) {
    const leg = new THREE.CylinderGeometry(0.24, 0.44, 1.35, 7);
    leg.translate(0, 0.56, 0);
    quat.setFromUnitVectors(up, dir.clone().normalize());
    leg.applyQuaternion(quat);
    parts.push(leg);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Builds a multi-part coastal coconut palm geometry (trunk + crown merged by group)
 */
function buildPalmTrunkGeo(): THREE.BufferGeometry {
  const segs: THREE.BufferGeometry[] = [];
  const pieces = 5;
  let curY = 0;
  let curX = 0;
  for (let i = 0; i < pieces; i++) {
    const h = 1.85;
    const rTop = 0.24 - i * 0.025;
    const rBot = 0.28 - i * 0.025;
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 7);
    const tilt = 0.06 + i * 0.035;
    g.rotateZ(-tilt);
    g.translate(curX + Math.sin(tilt) * h * 0.5, curY + h * 0.5, 0);
    curX += Math.sin(tilt) * h * 0.85;
    curY += Math.cos(tilt) * h * 0.94;
    segs.push(g);
  }
  const merged = mergeGeometries(segs, false);
  segs.forEach((s) => s.dispose());
  return merged;
}

function buildPalmCrownGeo(): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const leaf = new THREE.BoxGeometry(0.45, 0.08, 3.4);
    leaf.translate(0, 0, 1.55);
    leaf.rotateX(0.32 + (i % 2) * 0.18);
    leaf.rotateY(angle);
    fronds.push(leaf);
  }
  const merged = mergeGeometries(fronds, false);
  fronds.forEach((f) => f.dispose());
  return merged;
}

export class MarineDriveEnvironment {
  public readonly group = new THREE.Group();

  // Dynamic day/night materials & objects
  private roadMat: THREE.MeshStandardMaterial;
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.MeshBasicMaterial;
  private textures: ProceduralTexturePack;

  private artDecoMaterials: THREE.MeshStandardMaterial[] = [];
  private towerMaterials: THREE.MeshStandardMaterial[] = [];
  private lampBulbMat: THREE.MeshStandardMaterial;
  private lampHaloMesh: THREE.InstancedMesh;
  private beaconMat: THREE.MeshStandardMaterial;
  private stadiumLightMat: THREE.MeshStandardMaterial;
  private festiveLightMat: THREE.MeshStandardMaterial;
  private ferrisWheelRotor: THREE.Group | null = null;
  private groundApronMat: THREE.MeshStandardMaterial;

  constructor(textures: ProceduralTexturePack) {
    this.textures = textures;

    // 1. Sky Dome
    const skyGeo = new THREE.SphereGeometry(2800, 32, 20);
    this.skyMat = new THREE.MeshBasicMaterial({
      map: textures.nightSky,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.group.add(this.skyMesh);

    // 2. Curved 4-Lane Marine Drive Asphalt Road
    const roadGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      TRACK_END_BUFFER,
      -ROAD_HALF_WIDTH,
      ROAD_HALF_WIDTH,
      0.0,
      0.0,
      320,
      0.045
    );
    this.roadMat = new THREE.MeshStandardMaterial({
      map: textures.roadAlbedo,
      roughnessMap: textures.roadRoughness,
      roughness: 0.58,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // 3. Left Marine Drive Promenade Walkway (-8.4m to -14.2m) & Iconic Stone Parapet Seawall
    const promGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      TRACK_END_BUFFER,
      -14.2,
      -ROAD_HALF_WIDTH,
      0.22,
      0.22,
      260,
      0.18
    );
    const promMat = new THREE.MeshStandardMaterial({
      map: textures.promenadeAlbedo,
      roughness: 0.84,
      metalness: 0.04,
    });
    const promMesh = new THREE.Mesh(promGeo, promMat);
    promMesh.receiveShadow = true;
    this.group.add(promMesh);

    // Parapet Seawall top cap + vertical facing (runs from Nariman Point to Chowpatty Beach at 2960m)
    const wallTopGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      2960,
      -14.5,
      -13.6,
      1.04,
      1.04,
      220,
      0.1
    );
    const wallInnerGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      2960,
      -13.6,
      -13.6,
      1.04,
      0.22,
      220,
      0.1
    );
    const wallOuterGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      2960,
      -14.5,
      -14.5,
      -1.2,
      1.04,
      220,
      0.1
    );
    const seawallMat = new THREE.MeshStandardMaterial({
      color: '#a39c91',
      roughness: 0.88,
      metalness: 0.03,
    });
    this.group.add(
      new THREE.Mesh(wallTopGeo, seawallMat),
      new THREE.Mesh(wallInnerGeo, seawallMat),
      new THREE.Mesh(wallOuterGeo, seawallMat)
    );

    // 4. Girgaon Chowpatty Golden Sandy Beach (2930m -> 3840m on the left side)
    const beachGeo = buildCurvedRibbon(2930, TRACK_END_BUFFER, -95, -13.8, -1.6, 0.25, 65, 0.025);
    const beachMat = new THREE.MeshStandardMaterial({
      map: textures.sandAlbedo,
      roughness: 0.92,
      metalness: 0.02,
    });
    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    beachMesh.receiveShadow = true;
    this.group.add(beachMesh);

    // 5. Right Sidewalk (+8.4m to +14.8m) & South Mumbai Ground Apron (+14.8m to +260m)
    const rightWalkGeo = buildCurvedRibbon(
      TRACK_START_BUFFER,
      TRACK_END_BUFFER,
      ROAD_HALF_WIDTH,
      15.2,
      0.2,
      0.2,
      240,
      0.18
    );
    this.group.add(new THREE.Mesh(rightWalkGeo, promMat));

    const apronGeo = buildCurvedRibbon(
      TRACK_START_BUFFER - 120,
      TRACK_END_BUFFER + 180,
      14.5,
      360,
      0.08,
      0.08,
      120,
      0.02
    );
    this.groundApronMat = new THREE.MeshStandardMaterial({
      color: '#1b242c',
      roughness: 0.94,
    });
    this.group.add(new THREE.Mesh(apronGeo, this.groundApronMat));

    // 6. Instanced Mumbai Coastal Tetrapods along the entire seawall (-80m to 2940m)
    this.buildTetrapods();

    // 7. The Iconic "Queen's Necklace" Streetlamps & Warm Golden Halos
    this.lampBulbMat = new THREE.MeshStandardMaterial({
      color: '#fff4d6',
      emissive: new THREE.Color('#ffae34'),
      emissiveIntensity: 3.6,
      roughness: 0.2,
    });
    this.lampHaloMesh = this.buildQueensNecklaceLamps(textures.lightHalo);

    // 8. Swaying Coastal Coconut Palms along Marine Drive & Chowpatty
    this.buildCoastalPalms();

    // Shared dynamic landmark materials
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: new THREE.Color('#ff2432'),
      emissiveIntensity: 4.0,
      roughness: 0.2,
    });
    this.stadiumLightMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      emissive: new THREE.Color('#e0f2fe'),
      emissiveIntensity: 4.5,
      roughness: 0.15,
    });
    this.festiveLightMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 3.2,
      roughness: 0.2,
    });

    // 9. Authentic Mumbai Landmarks & Architectural Skyline
    this.buildRaceGantries();
    this.buildNarimanPointSkyline();
    this.buildArtDecoMile();
    this.buildMarineLinesAndWankhede();
    this.buildGirgaonChowpattyAndMalabarHill();
  }

  private buildTetrapods(): void {
    const tetraGeo = buildTetrapodGeometry();
    const tetraMat = new THREE.MeshStandardMaterial({
      color: '#8f8b83',
      roughness: 0.9,
      metalness: 0.04,
    });

    const count = 560;
    const mesh = new THREE.InstancedMesh(tetraGeo, tetraMat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const s = -80 + (i / count) * 3020 + (Math.random() - 0.5) * 4;
      sampleTrack(s, _pos, _tan, _right);
      const u = -15.3 - Math.random() * 5.2;
      const y = -0.82 + Math.random() * 0.85;
      _dummy.position.set(_pos.x + _right.x * u, y, _pos.z + _right.z * u);
      _dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI
      );
      const scale = 0.85 + Math.random() * 0.48;
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      // Subtle weathered sea-salt & wet stone color variation
      const shade = 0.72 + Math.random() * 0.32;
      _color.setRGB(0.56 * shade, 0.54 * shade, 0.5 * shade);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  private buildQueensNecklaceLamps(haloTex: THREE.CanvasTexture): THREE.InstancedMesh {
    // Classic Art Deco tall arched pole + luminaire housing
    const spacing = 26;
    const startS = -60;
    const endS = 3740;
    const countPerSide = Math.floor((endS - startS) / spacing);
    const totalPoles = countPerSide * 2; // Promenade side + Art Deco side

    const poleParts: THREE.BufferGeometry[] = [];
    const shaft = new THREE.CylinderGeometry(0.08, 0.14, 7.6, 8);
    shaft.translate(0, 3.8, 0);
    const arm = new THREE.BoxGeometry(1.75, 0.1, 0.1);
    arm.translate(0.85, 7.55, 0);
    const hood = new THREE.CylinderGeometry(0.28, 0.42, 0.24, 8);
    hood.translate(1.65, 7.48, 0);
    poleParts.push(shaft, arm, hood);
    const poleGeo = mergeGeometries(poleParts, false);
    poleParts.forEach((p) => p.dispose());

    const poleMat = new THREE.MeshStandardMaterial({
      color: '#2c3544',
      metalness: 0.75,
      roughness: 0.35,
    });
    const polesInst = new THREE.InstancedMesh(poleGeo, poleMat, totalPoles);
    polesInst.frustumCulled = false;

    const bulbGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const bulbsInst = new THREE.InstancedMesh(bulbGeo, this.lampBulbMat, totalPoles);
    bulbsInst.frustumCulled = false;

    const haloPlaneA = new THREE.PlaneGeometry(5.6, 5.6);
    const haloPlaneB = new THREE.PlaneGeometry(5.6, 5.6);
    haloPlaneB.rotateY(Math.PI / 2);
    const haloGeo = mergeGeometries([haloPlaneA, haloPlaneB], false);
    haloPlaneA.dispose();
    haloPlaneB.dispose();
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      color: new THREE.Color('#ffbd4a'),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const halosInst = new THREE.InstancedMesh(haloGeo, haloMat, totalPoles);
    halosInst.frustumCulled = false;

    let idx = 0;
    for (let i = 0; i < countPerSide; i++) {
      const s = startS + i * spacing;
      sampleTrack(s, _pos, _tan, _right);
      const yaw = getTrackYaw(_tan);

      // Promenade side (left: u = -10.8, arm reaches +right over road)
      _dummy.position.set(_pos.x + _right.x * -10.8, 0.22, _pos.z + _right.z * -10.8);
      _dummy.rotation.set(0, yaw, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      polesInst.setMatrixAt(idx, _dummy.matrix);

      const bxL = _pos.x + _right.x * (-10.8 + 1.65);
      const bzL = _pos.z + _right.z * (-10.8 + 1.65);
      _dummy.position.set(bxL, 7.52, bzL);
      _dummy.rotation.set(0, yaw, 0);
      _dummy.updateMatrix();
      bulbsInst.setMatrixAt(idx, _dummy.matrix);
      halosInst.setMatrixAt(idx, _dummy.matrix);
      idx++;

      // City side (right: u = +10.8, rotated PI so arm reaches -right over road)
      _dummy.position.set(_pos.x + _right.x * 10.8, 0.2, _pos.z + _right.z * 10.8);
      _dummy.rotation.set(0, yaw + Math.PI, 0);
      _dummy.updateMatrix();
      polesInst.setMatrixAt(idx, _dummy.matrix);

      const bxR = _pos.x + _right.x * (10.8 - 1.65);
      const bzR = _pos.z + _right.z * (10.8 - 1.65);
      _dummy.position.set(bxR, 7.5, bzR);
      _dummy.rotation.set(0, yaw, 0);
      _dummy.updateMatrix();
      bulbsInst.setMatrixAt(idx, _dummy.matrix);
      halosInst.setMatrixAt(idx, _dummy.matrix);
      idx++;
    }

    polesInst.instanceMatrix.needsUpdate = true;
    bulbsInst.instanceMatrix.needsUpdate = true;
    halosInst.instanceMatrix.needsUpdate = true;

    this.group.add(polesInst, bulbsInst, halosInst);
    return halosInst;
  }

  private buildCoastalPalms(): void {
    const trunkGeo = buildPalmTrunkGeo();
    const crownGeo = buildPalmCrownGeo();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5845', roughness: 0.92 });
    const crownMat = new THREE.MeshStandardMaterial({ color: '#2b5e34', roughness: 0.78 });

    const spots: { s: number; u: number; scale: number; rotY: number }[] = [];
    // Right sidewalk palms + promenade pockets + Chowpatty beach grove
    for (let s = 20; s < 3680; s += 34) {
      spots.push({
        s: s + (Math.random() - 0.5) * 8,
        u: 12.6 + Math.random() * 2.2,
        scale: 0.85 + Math.random() * 0.35,
        rotY: Math.random() * Math.PI * 2,
      });
      if (s > 1480 && s < 2140) {
        // Extra lush Marine Lines gymkhana palms
        spots.push({
          s: s + 12,
          u: 19 + Math.random() * 14,
          scale: 0.95 + Math.random() * 0.4,
          rotY: Math.random() * Math.PI * 2,
        });
      }
      if (s > 2960 && s < 3660) {
        // Girgaon Chowpatty beachfront coconut palms
        spots.push({
          s: s + 10,
          u: -16.5 - Math.random() * 12,
          scale: 0.9 + Math.random() * 0.42,
          rotY: Math.random() * Math.PI * 2,
        });
      }
    }

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    trunks.frustumCulled = false;
    crowns.frustumCulled = false;

    spots.forEach((sp, i) => {
      sampleTrack(sp.s, _pos, _tan, _right);
      const wx = _pos.x + _right.x * sp.u;
      const wz = _pos.z + _right.z * sp.u;

      _dummy.position.set(wx, 0.15, wz);
      _dummy.rotation.set(0, sp.rotY, 0);
      _dummy.scale.setScalar(sp.scale);
      _dummy.updateMatrix();
      trunks.setMatrixAt(i, _dummy.matrix);

      // Crown sits at top of curved trunk (~8.5m * scale)
      const crownOff = 1.15 * sp.scale;
      _dummy.position.set(
        wx + Math.cos(sp.rotY) * crownOff,
        0.15 + 8.55 * sp.scale,
        wz - Math.sin(sp.rotY) * crownOff
      );
      _dummy.updateMatrix();
      crowns.setMatrixAt(i, _dummy.matrix);

      const tint = 0.8 + Math.random() * 0.35;
      _color.setRGB(0.18 * tint, 0.42 * tint, 0.2 * tint);
      crowns.setColorAt(i, _color);
    });

    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    this.group.add(trunks, crowns);
  }

  private buildRaceGantries(): void {
    const createGantry = (s: number, bannerTex: THREE.CanvasTexture, accentHex: string) => {
      const g = new THREE.Group();
      sampleTrack(s, _pos, _tan, _right);
      g.position.copy(_pos);
      g.rotation.y = getTrackYaw(_tan);

      const steelMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.82,
        roughness: 0.28,
      });
      const stripMat = new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: new THREE.Color(accentHex),
        emissiveIntensity: 2.2,
      });

      // Twin sculpted trusses flanking road
      [-9.6, 9.6].forEach((x) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 8.8, 1.1), steelMat);
        pillar.position.set(x, 4.4, 0);
        g.add(pillar);
        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.6, 1.18), stripMat);
        neonStrip.position.set(x > 0 ? x - 0.48 : x + 0.48, 4.4, 0);
        g.add(neonStrip);
      });

      // Overhead illuminated signage board
      const headerMat = new THREE.MeshStandardMaterial({
        map: bannerTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveMap: bannerTex,
        emissiveIntensity: 0.85,
        roughness: 0.35,
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(20.2, 2.8, 0.7), [
        steelMat,
        steelMat,
        steelMat,
        steelMat,
        headerMat,
        headerMat,
      ]);
      board.position.set(0, 8.1, 0);
      g.add(board);

      this.group.add(g);
    };

    createGantry(18, this.textures.startBanner, '#f59e0b');
    createGantry(TRACK_LENGTH, this.textures.finishBanner, '#10b981');
  }

  private createArtDecoMaterial(tintHex: string): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tintHex),
      map: this.textures.artDecoDay,
      emissive: new THREE.Color('#ffd38c'),
      emissiveMap: this.textures.artDecoEmissive,
      emissiveIntensity: 1.5,
      roughness: 0.72,
      metalness: 0.08,
    });
    this.artDecoMaterials.push(mat);
    return mat;
  }

  private createTowerMaterial(tintHex: string): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tintHex),
      map: this.textures.towerDay,
      emissive: new THREE.Color('#ffdfa0'),
      emissiveMap: this.textures.towerEmissive,
      emissiveIntensity: 1.85,
      roughness: 0.34,
      metalness: 0.48,
    });
    this.towerMaterials.push(mat);
    return mat;
  }

  /**
   * Nariman Point (s = -40..490): Air India Building, Oberoi & Trident, NCPA skyline
   */
  private buildNarimanPointSkyline(): void {
    const concreteMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.75 });
    const trimGoldMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 2.2,
    });

    // 1. Air India Building (iconic terraced Nariman Point skyscraper, s = 92)
    {
      const airIndia = new THREE.Group();
      sampleTrack(92, _pos, _tan, _right);
      airIndia.position.set(_pos.x + _right.x * 38, 0, _pos.z + _right.z * 38);
      airIndia.rotation.y = getTrackYaw(_tan);

      const towerMat = this.createTowerMaterial('#d6dbe2');
      // Elevated modernist podium
      const podium = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 34), concreteMat);
      podium.position.y = 6;
      // Main soaring tower shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(22, 68, 26), towerMat);
      shaft.position.y = 46;
      // Iconic crowned crimson/amber rooftop penthouse
      const crown = new THREE.Mesh(new THREE.BoxGeometry(23.5, 4.5, 27.5), this.beaconMat);
      crown.position.y = 81.5;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 16, 8), concreteMat);
      spire.position.y = 91;
      const beaconOrb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.beaconMat);
      beaconOrb.position.y = 99;

      airIndia.add(podium, shaft, crown, spire, beaconOrb);
      this.group.add(airIndia);
    }

    // 2. Trident & The Oberoi Marine Drive (twin luxury curved coastal hotels, s = 230 & 340)
    [
      { s: 235, h: 78, w: 32, d: 24, tint: '#e2d8c8' },
      { s: 345, h: 56, w: 38, d: 26, tint: '#cbd5e1' },
    ].forEach((hotel) => {
      const hg = new THREE.Group();
      sampleTrack(hotel.s, _pos, _tan, _right);
      hg.position.set(_pos.x + _right.x * 36, 0, _pos.z + _right.z * 36);
      hg.rotation.y = getTrackYaw(_tan);

      const mat = this.createTowerMaterial(hotel.tint);
      const body = new THREE.Mesh(new THREE.BoxGeometry(hotel.d, hotel.h, hotel.w), mat);
      body.position.y = hotel.h * 0.5;
      const crownBand = new THREE.Mesh(
        new THREE.BoxGeometry(hotel.d + 0.8, 1.4, hotel.w + 0.8),
        trimGoldMat
      );
      crownBand.position.y = hotel.h - 2.0;
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 16), trimGoldMat);
      canopy.position.set(-hotel.d * 0.5 - 2.5, 5.2, 0);

      hg.add(body, crownBand, canopy);
      this.group.add(hg);
    });

    // 3. Background Nariman Point Financial District High-Rises
    const bgTowers = [
      { s: -40, u: 45, h: 64, w: 26, d: 22 },
      { s: 25, u: 68, h: 86, w: 28, d: 28 },
      { s: 165, u: 72, h: 92, w: 30, d: 26 },
      { s: 290, u: 78, h: 74, w: 32, d: 28 },
      { s: 430, u: 44, h: 58, w: 28, d: 24 },
      { s: 455, u: 85, h: 82, w: 32, d: 30 },
    ];
    const bgMat = this.createTowerMaterial('#94a3b8');
    bgTowers.forEach((bt) => {
      sampleTrack(bt.s, _pos, _tan, _right);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bt.d, bt.h, bt.w), bgMat);
      mesh.position.set(_pos.x + _right.x * bt.u, bt.h * 0.5, _pos.z + _right.z * bt.u);
      mesh.rotation.y = getTrackYaw(_tan);
      this.group.add(mesh);
    });
  }

  /**
   * UNESCO World Heritage Mumbai Art Deco Mansions lining Marine Drive
   * (510m..1450m and 2160m..2980m): pastel cream/ochre/coral facades,
   * curved corner balconies, stepped Art Deco crowns, warm night uplighting.
   */
  private buildArtDecoMile(): void {
    const palette = ['#f0e4d0', '#e8d3b9', '#ebd9c8', '#dce3e0', '#eedac2'];
    const mats = palette.map((hex) => this.createArtDecoMaterial(hex));
    const trimMat = new THREE.MeshStandardMaterial({ color: '#f5efe2', roughness: 0.65 });
    const uplightMat = new THREE.MeshStandardMaterial({
      color: '#ffce7a',
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.9,
    });
    this.artDecoMaterials.push(uplightMat);

    const ranges: [number, number][] = [
      [510, 1450],
      [2160, 2980],
    ];

    let bIdx = 0;
    for (const [startS, endS] of ranges) {
      for (let s = startS; s < endS; s += 42) {
        sampleTrack(s, _pos, _tan, _right);
        const g = new THREE.Group();
        const setback = 27 + (bIdx % 3) * 2.5;
        g.position.set(_pos.x + _right.x * setback, 0, _pos.z + _right.z * setback);
        g.rotation.y = getTrackYaw(_tan);

        const height = 21 + ((bIdx * 7) % 14); // authentic 5–7 storey Art Deco coastal skyline
        const length = 31 + (bIdx % 3) * 3;
        const depth = 17;
        const mat = mats[bIdx % mats.length];

        // Primary Art Deco block
        const body = new THREE.Mesh(new THREE.BoxGeometry(depth, height, length), mat);
        body.position.y = height * 0.5;
        g.add(body);

        // Signature rounded Art Deco corner balcony cylinders on sea-facing corners
        const cornerGeo = new THREE.CylinderGeometry(3.2, 3.2, height - 1.2, 12);
        const c1 = new THREE.Mesh(cornerGeo, mat);
        c1.position.set(-depth * 0.45, (height - 1.2) * 0.5, -length * 0.44);
        const c2 = new THREE.Mesh(cornerGeo, mat);
        c2.position.set(-depth * 0.45, (height - 1.2) * 0.5, length * 0.44);
        g.add(c1, c2);

        // Stepped Ziggurat Art Deco Roofline Crown
        const crown1 = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.8, 1.4, length + 0.8), trimMat);
        crown1.position.y = height + 0.7;
        const crown2 = new THREE.Mesh(new THREE.BoxGeometry(depth * 0.65, 2.2, length * 0.42), trimMat);
        crown2.position.y = height + 2.4;
        g.add(crown1, crown2);

        // Warm architectural cornice accent band (glows softly at night)
        const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, length * 0.86), uplightMat);
        lightStrip.position.set(-depth * 0.5 - 0.15, height - 0.6, 0);
        g.add(lightStrip);

        this.group.add(g);
        bIdx++;
      }
    }
  }

  /**
   * Marine Lines Gymkhanas (1460..2150) & Towering Wankhede Stadium Floodlights
   */
  private buildMarineLinesAndWankhede(): void {
    // Lush Gymkhana Cricket Lawns along the east side
    const lawnGeo = buildCurvedRibbon(1460, 2140, 15.5, 95, 0.18, 0.18, 36, 0.05);
    const lawnMat = new THREE.MeshStandardMaterial({ color: '#245232', roughness: 0.92 });
    this.group.add(new THREE.Mesh(lawnGeo, lawnMat));

    // Heritage Gymkhana Clubhouses (Islam / Parsi / Hindu Gymkhana pitched terracotta roofs)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#ece3d0', roughness: 0.78 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#8f3a2b', roughness: 0.82 });

    [1580, 1790, 2010].forEach((s) => {
      sampleTrack(s, _pos, _tan, _right);
      const club = new THREE.Group();
      club.position.set(_pos.x + _right.x * 42, 0.18, _pos.z + _right.z * 42);
      club.rotation.y = getTrackYaw(_tan);

      const base = new THREE.Mesh(new THREE.BoxGeometry(16, 7.5, 28), wallMat);
      base.position.y = 3.75;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(16, 6.5, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(0.82, 1, 1.38);
      roof.position.y = 10.6;
      club.add(base, roof);
      this.group.add(club);
    });

    // Wankhede Stadium Rising Behind Marine Lines with 4 Iconic Glowing Floodlight Towers!
    const mastMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.72, roughness: 0.35 });
    const bowlMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });

    sampleTrack(1820, _pos, _tan, _right);
    const wankhede = new THREE.Group();
    wankhede.position.set(_pos.x + _right.x * 135, 0, _pos.z + _right.z * 135);
    wankhede.rotation.y = getTrackYaw(_tan);

    const stadiumRing = new THREE.Mesh(new THREE.CylinderGeometry(52, 46, 22, 24, 1, true), bowlMat);
    stadiumRing.position.y = 11;
    wankhede.add(stadiumRing);

    [
      [-42, -40],
      [42, -40],
      [-42, 40],
      [42, 40],
    ].forEach(([tx, tz]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.0, 68, 8), mastMat);
      mast.position.set(tx, 34, tz);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 2.2), this.stadiumLightMat);
      bank.position.set(tx, 69, tz);
      bank.lookAt(0, 12, 0);
      wankhede.add(mast, bank);
    });
    this.group.add(wankhede);
  }

  /**
   * Girgaon Chowpatty Festive Beachfront + Rotating Illuminated Ferris Wheel +
   * Towering Malabar Hill Headland glittering with apartment towers ahead!
   */
  private buildGirgaonChowpattyAndMalabarHill(): void {
    // 1. Chowpatty Beachfront Bhelpuri / Kulfi Stalls with Warm Glowing Canopies
    const stallRoofMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.75 });
    const stallBaseMat = new THREE.MeshStandardMaterial({ color: '#e2d9c8', roughness: 0.8 });

    for (let s = 3040; s <= 3520; s += 38) {
      sampleTrack(s, _pos, _tan, _right);
      const stall = new THREE.Group();
      const u = -22 - (s % 3) * 4;
      stall.position.set(_pos.x + _right.x * u, 0.05, _pos.z + _right.z * u);
      stall.rotation.y = getTrackYaw(_tan);

      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 7.5), stallBaseMat);
      counter.position.y = 0.7;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 8.6), stallRoofMat);
      roof.position.y = 3.2;
      const bulbStrip = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 8.7), this.festiveLightMat);
      bulbStrip.position.y = 2.95;

      stall.add(counter, roof, bulbStrip);
      this.group.add(stall);
    }

    // 2. Iconic Girgaon Chowpatty Beach Illuminated Ferris Wheel (rotates smoothly!)
    sampleTrack(3360, _pos, _tan, _right);
    const ferrisBase = new THREE.Group();
    ferrisBase.position.set(_pos.x + _right.x * -44, 0, _pos.z + _right.z * -44);
    ferrisBase.rotation.y = getTrackYaw(_tan) + 0.35;

    const frameMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.35 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 22, 8), frameMat);
    legL.position.set(-4.5, 10.5, 0);
    legL.rotation.z = -0.22;
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 22, 8), frameMat);
    legR.position.set(4.5, 10.5, 0);
    legR.rotation.z = 0.22;
    ferrisBase.add(legL, legR);

    const rotor = new THREE.Group();
    rotor.position.set(0, 20, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.36, 10, 32), this.festiveLightMat);
    rotor.add(rim);

    const spokeGeo = new THREE.CylinderGeometry(0.12, 0.12, 29, 6);
    const cabinGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, frameMat);
      spoke.rotation.z = a;
      rotor.add(spoke);

      const cabin = new THREE.Mesh(cabinGeo, this.festiveLightMat);
      cabin.position.set(Math.cos(a) * 14.5, Math.sin(a) * 14.5, 0);
      rotor.add(cabin);
    }
    ferrisBase.add(rotor);
    this.ferrisWheelRotor = rotor;
    this.group.add(ferrisBase);

    // 3. Dramatic Malabar Hill Headland rising across Back Bay well clear of the road & finish arch
    sampleTrack(TRACK_LENGTH + 440, _pos, _tan, _right);
    const hillGroup = new THREE.Group();
    // Offset 360m toward the sea/headland side so the mountain never touches the road or finish zone
    hillGroup.position.set(_pos.x + _right.x * -360, -2, _pos.z + _right.z * -360);
    hillGroup.rotation.y = getTrackYaw(_tan);

    const hillMat = new THREE.MeshStandardMaterial({ color: '#1b3526', roughness: 0.95 });
    const hill1 = new THREE.Mesh(new THREE.ConeGeometry(185, 88, 16), hillMat);
    hill1.scale.set(1.1, 1, 0.85);
    hill1.position.set(0, 36, 0);
    const hill2 = new THREE.Mesh(new THREE.ConeGeometry(145, 70, 14), hillMat);
    hill2.position.set(-135, 28, -35);
    hillGroup.add(hill1, hill2);

    // Glittering Malabar Hill & Walkeshwar luxury residential towers crowning the headland
    const malabarMat = this.createTowerMaterial('#cbd5e1');
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 1.3 - 0.65;
      const dist = 28 + (i % 4) * 28;
      const h = 36 + ((i * 19) % 44);
      const w = 13 + (i % 3) * 4;
      const tx = -Math.abs(Math.cos(angle) * dist) - 10;
      const tz = Math.sin(angle) * dist;
      const elev = Math.max(12, 56 - dist * 0.3);
      const tw = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), malabarMat);
      tw.position.set(tx, elev + h * 0.4, tz);
      hillGroup.add(tw);
    }

    this.group.add(hillGroup);
  }

  public setTimeOfDay(mode: TimeOfDay): void {
    const isNight = mode === 'night';
    this.skyMat.map = isNight ? this.textures.nightSky : this.textures.daySky;
    this.skyMat.needsUpdate = true;

    // Subtle damp coastal sheen on Marine Drive asphalt at night vs crisp sun-baked asphalt by day
    this.roadMat.roughness = isNight ? 0.34 : 0.68;
    this.roadMat.metalness = isNight ? 0.22 : 0.08;
    this.groundApronMat.color.set(isNight ? '#111824' : '#3d4c46');

    // Queen's Necklace streetlamps & glowing halos
    this.lampBulbMat.emissiveIntensity = isNight ? 4.4 : 0.15;
    this.lampHaloMesh.visible = isNight;

    // Authentic landmark facade illumination
    for (const m of this.artDecoMaterials) {
      m.emissiveIntensity = isNight ? 1.85 : 0.0;
    }
    for (const m of this.towerMaterials) {
      m.emissiveIntensity = isNight ? 2.1 : 0.0;
    }
    this.beaconMat.emissiveIntensity = isNight ? 4.6 : 0.5;
    this.stadiumLightMat.emissiveIntensity = isNight ? 5.2 : 0.25;
    this.festiveLightMat.emissiveIntensity = isNight ? 3.8 : 0.25;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    // Keep sky dome centered on camera/player so horizon never clips
    this.skyMesh.position.set(playerPos.x, 0, playerPos.z);

    // Rotate Girgaon Chowpatty Ferris wheel smoothly
    if (this.ferrisWheelRotor) {
      this.ferrisWheelRotor.rotation.z += dt * 0.18;
    }
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
