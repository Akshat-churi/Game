import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RaceAudioEngine } from './audio';
import { createSportbikeRig, type SportbikeRig } from './bikeModel';
import { MarineDriveEnvironment } from './environment';
import { ArabianSeaSystem } from './ocean';
import { createProceduralTextures, type ProceduralTexturePack } from './textures';
import {
  getLandmarkAt,
  getTrackYaw,
  ROAD_HALF_WIDTH,
  sampleTrack,
  TRACK_LENGTH,
} from './track';
import {
  computeBikeStats,
  type BikeVisualConfig,
  type CameraMode,
  type GameScreen,
  type HandlingTuning,
  type HudTelemetry,
  type RaceResult,
  type TimeOfDay,
  type TrafficDensity,
  type UpgradeLevels,
} from './types';
import { TrafficAndRivalsManager } from './traffic';

interface SparkParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export interface EngineCallbacks {
  onTelemetry: (telemetry: HudTelemetry) => void;
  onScreenChange: (screen: GameScreen) => void;
  onRaceFinish: (result: RaceResult) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable zero-GC module-scope math helpers
const _trackPos = new THREE.Vector3();
const _trackTan = new THREE.Vector3();
const _trackRight = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _cockpitWorld = new THREE.Vector3();
const _dummy = new THREE.Object3D();

export class MarineDriveEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;

  private textures: ProceduralTexturePack;
  private environment: MarineDriveEnvironment;
  private ocean: ArabianSeaSystem;
  private traffic: TrafficAndRivalsManager;
  private playerRig: SportbikeRig;
  private audio: RaceAudioEngine;

  // Lighting rig
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  // Sparks pooled particle mesh for collision impact feedback
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkParticle[] = [];

  // Game & Physics State
  private screen: GameScreen = 'title';
  private timeOfDay: TimeOfDay = 'night';
  private trafficDensity: TrafficDensity = 'medium';
  private cameraMode: CameraMode = 'chase';

  private upgrades: UpgradeLevels;
  private handling: HandlingTuning;
  private visuals: BikeVisualConfig;
  private bestTimeSec: number | null;

  // Player kinematic variables
  private playerS = 0;
  private playerU = 2.0;
  private speedMps = 0;
  private latVel = 0;
  private leanAngle = 0;
  private wheeliePitch = 0;
  private nitro = 100;
  private isBoosting = false;
  private raceElapsed = 0;
  private countdownTimer = 0;
  private lastCountdownInt = 4;

  // Scoring & Game Feel
  private score = 0;
  private topSpeedKmh = 0;
  private nearMissCount = 0;
  private nearMissCombo = 0;
  private nearMissComboTimer = 0;
  private nearMissBanner: string | null = null;
  private nearMissBannerTimer = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private invulnTimer = 0;
  private damageFlash = 0;

  // Camera showcase orbit state (interactive drag in garage!)
  private garageOrbitYaw = 0.58;
  private garageOrbitPitch = 0.2;
  private isDraggingOrbit = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private camCurrentPos = new THREE.Vector3();
  private camCurrentLook = new THREE.Vector3();
  private camInitialized = false;

  // Input state (continuous held vs edge-triggered)
  private held = {
    up: false,
    down: false,
    left: false,
    right: false,
    nitro: false,
  };
  private touchInput = {
    left: false,
    right: false,
    power: false,
    brake: false,
    nitro: false,
  };

  // Loop & timing
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private hudEmitAccum = 0;
  private totalElapsed = 0;

  constructor(
    container: HTMLElement,
    initial: {
      upgrades: UpgradeLevels;
      handling: HandlingTuning;
      visuals: BikeVisualConfig;
      timeOfDay: TimeOfDay;
      trafficDensity: TrafficDensity;
      bestTimeSec: number | null;
    },
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.upgrades = { ...initial.upgrades };
    this.handling = { ...initial.handling };
    this.visuals = { ...initial.visuals };
    this.timeOfDay = initial.timeOfDay;
    this.trafficDensity = initial.trafficDensity;
    this.bestTimeSec = initial.bestTimeSec;

    // Software WebGL guard (strictly rendering cost only — identical scene content)
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Scene & Studio PMREM Environment Map (essential for metallic bike paint & anodized chrome)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#091326');
    this.scene.fog = new THREE.FogExp2('#0b1730', 0.00145);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.15, 3600);

    // Balanced 3-Point Warm/Cool Coastal Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x88b4e6, 0x262938, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffdfad, 2.2);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 160;
    const d = 34;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0xf59e0b, 0.65);
    this.rimLight.position.set(20, 18, 30);
    this.scene.add(this.rimLight);

    // Procedural Textures & World Systems
    this.textures = createProceduralTextures(this.renderer);
    this.environment = new MarineDriveEnvironment(this.textures);
    this.scene.add(this.environment.group);

    this.ocean = new ArabianSeaSystem(this.textures.lightHalo);
    this.scene.add(this.ocean.group);

    this.traffic = new TrafficAndRivalsManager(
      this.textures.tireTread,
      this.textures.contactShadow,
      this.textures.lightHalo
    );
    this.scene.add(this.traffic.group);

    this.playerRig = createSportbikeRig(
      this.visuals,
      this.textures.tireTread,
      this.textures.contactShadow,
      this.textures.lightHalo,
      true
    );
    this.scene.add(this.playerRig.root);

    // Pooled collision sparks
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.36);
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffbe42' });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, 48);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 48; i++) {
      this.sparks.push({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    this.audio = new RaceAudioEngine();

    // Apply initial mode & density
    this.setTimeOfDay(this.timeOfDay);
    this.setTrafficDensity(this.trafficDensity);
    this.resetPlayerAtNarimanPoint();

    // Pre-warm shaders on GPU (skip on software WebGL)
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onWebglLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onWebglRestored);

    this.clock.start();
    this.tick();
  }

  public setTimeOfDay(mode: TimeOfDay): void {
    this.timeOfDay = mode;
    const isNight = mode === 'night';

    this.environment.setTimeOfDay(mode);
    this.ocean.setTimeOfDay(mode);
    this.playerRig.setNightMode(isNight);
    this.traffic.setTimeOfDay(isNight);

    if (isNight) {
      this.scene.background = new THREE.Color('#071024');
      (this.scene.fog as THREE.FogExp2).color.set('#0c1830');
      (this.scene.fog as THREE.FogExp2).density = 0.00125;

      this.hemiLight.color.set('#4c6ea8');
      this.hemiLight.groundColor.set('#2b2016');
      this.hemiLight.intensity = 0.72;

      this.keyLight.color.set('#b8d4ff');
      this.keyLight.intensity = 1.05;

      // Warm Queen's Necklace rim glow across bike fairing
      this.rimLight.color.set('#ffaa33');
      this.rimLight.intensity = 1.35;
      this.renderer.toneMappingExposure = 1.18;
    } else {
      this.scene.background = new THREE.Color('#8ac4eb');
      (this.scene.fog as THREE.FogExp2).color.set('#c9dfee');
      (this.scene.fog as THREE.FogExp2).density = 0.00072;

      this.hemiLight.color.set('#9fd2f7');
      this.hemiLight.groundColor.set('#7a6c58');
      this.hemiLight.intensity = 0.95;

      this.keyLight.color.set('#fff1d4');
      this.keyLight.intensity = 2.65;

      this.rimLight.color.set('#ffe4b5');
      this.rimLight.intensity = 0.55;
      this.renderer.toneMappingExposure = 1.04;
    }
  }

  public setTrafficDensity(density: TrafficDensity): void {
    this.trafficDensity = density;
    this.traffic.setDensity(density);
    if (this.screen === 'title' || this.screen === 'garage') {
      this.traffic.resetForRace();
    }
  }

  public setBikeConfig(
    upgrades: UpgradeLevels,
    handling: HandlingTuning,
    visuals: BikeVisualConfig
  ): void {
    this.upgrades = { ...upgrades };
    this.handling = { ...handling };
    this.visuals = { ...visuals };
    this.playerRig.applyVisuals(this.visuals);
  }

  public setBestTime(sec: number | null): void {
    this.bestTimeSec = sec;
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.playerRig.riderGroup.visible = mode === 'chase';
  }

  public toggleCameraMode(): CameraMode {
    const next: CameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
    this.setCameraMode(next);
    return next;
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public unlockAudio(): void {
    this.audio.unlock();
  }

  public setTouchControl(
    control: 'left' | 'right' | 'power' | 'brake' | 'nitro',
    active: boolean
  ): void {
    this.touchInput[control] = active;
  }

  public enterTitle(): void {
    this.screen = 'title';
    this.setCameraMode('chase');
    this.resetPlayerAtNarimanPoint();
    this.callbacks.onScreenChange('title');
  }

  public enterGarage(): void {
    this.audio.unlock();
    this.screen = 'garage';
    this.setCameraMode('chase');
    this.resetPlayerAtNarimanPoint();
    this.garageOrbitYaw = 0.62;
    this.garageOrbitPitch = 0.2;
    this.callbacks.onScreenChange('garage');
  }

  public startRace(): void {
    this.audio.unlock();
    this.resetPlayerAtNarimanPoint();
    this.traffic.resetForRace();
    this.screen = 'countdown';
    this.countdownTimer = 3.0;
    this.lastCountdownInt = 4;
    this.raceElapsed = 0;
    this.score = 0;
    this.topSpeedKmh = 0;
    this.nearMissCount = 0;
    this.nearMissCombo = 0;
    this.nearMissComboTimer = 0;
    this.nearMissBanner = null;
    this.nearMissBannerTimer = 0;
    this.nitro = 100;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.invulnTimer = 0;
    this.damageFlash = 0;
    this.callbacks.onScreenChange('countdown');
    this.emitTelemetry();
  }

  public pauseRace(): void {
    if (this.screen === 'racing') {
      this.screen = 'paused';
      this.clearHeldKeys();
      this.callbacks.onScreenChange('paused');
    }
  }

  public resumeRace(): void {
    if (this.screen === 'paused') {
      this.screen = 'racing';
      this.clock.getDelta(); // swallow paused elapsed time
      this.callbacks.onScreenChange('racing');
    }
  }

  private resetPlayerAtNarimanPoint(): void {
    this.playerS = 0;
    this.playerU = 1.9;
    this.speedMps = 0;
    this.latVel = 0;
    this.leanAngle = 0;
    this.wheeliePitch = 0;
    this.isBoosting = false;
    this.playerRig.setBoosting(false, 0);
    this.playerRig.setBraking(false);
    this.traffic.resetForRace();
    this.syncPlayerTransform();
  }

  private syncPlayerTransform(): void {
    sampleTrack(this.playerS, _trackPos, _trackTan, _trackRight);
    const wx = _trackPos.x + _trackRight.x * this.playerU;
    const wz = _trackPos.z + _trackRight.z * this.playerU;
    this.playerRig.root.position.set(wx, 0, wz);
    this.playerRig.root.rotation.y = getTrackYaw(_trackTan);
    this.playerRig.leanGroup.rotation.z = this.leanAngle;
    this.playerRig.leanGroup.rotation.x = this.wheeliePitch;

    // Keep shadow key-light centered on player so shadows stay crisp all 3.6 km!
    const isNight = this.timeOfDay === 'night';
    this.keyLight.position.set(
      wx + (isNight ? -42 : -55),
      isNight ? 48 : 62,
      wz + (isNight ? -32 : -28)
    );
    this.keyLight.target.position.set(wx, 0, wz);
    this.keyLight.target.updateMatrixWorld();
  }

  private spawnCollisionSparks(wx: number, wz: number): void {
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      sp.x = wx + (Math.random() - 0.5) * 0.6;
      sp.y = 0.65 + Math.random() * 0.5;
      sp.z = wz + (Math.random() - 0.5) * 0.6;
      sp.vx = (Math.random() - 0.5) * 14;
      sp.vy = 2.5 + Math.random() * 6.5;
      sp.vz = (Math.random() - 0.5) * 14;
      sp.life = 0.35 + Math.random() * 0.35;
    }
  }

  private updateSparks(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (sp.life > 0) {
        sp.life -= dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        sp.vy -= 18 * dt;
        if (sp.y < 0.05) {
          sp.y = 0.05;
          sp.vy = Math.abs(sp.vy) * 0.4;
        }
        const sc = Math.max(0.001, sp.life * 2.2);
        _dummy.position.set(sp.x, sp.y, sp.z);
        _dummy.rotation.set(sp.life * 10, sp.life * 7, 0);
        _dummy.scale.setScalar(sc);
        _dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, _dummy.matrix);
        dirty = true;
      }
    }
    if (dirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private stepPhysics(dt: number): void {
    const stats = computeBikeStats(this.upgrades, this.handling, this.visuals.bikeClass);

    const braking = this.held.down || this.touchInput.brake;
    const steerLeft = this.held.left || this.touchInput.left;
    const steerRight = this.held.right || this.touchInput.right;
    // Bike runs continuously at normal speed; Power button (or Shift/Space/Up) fires temporary Speed Boost
    const boostRequested =
      this.touchInput.power || this.touchInput.nitro || this.held.nitro || this.held.up;
    const wantsBoost = !braking && boostRequested && this.nitro > 4;

    this.isBoosting = wantsBoost;
    const normalCruiseMps = stats.topSpeedKmh / 3.6;
    const boostMaxMps = stats.boostTopSpeedKmh / 3.6;

    // Longitudinal speed dynamics: continuous auto-cruise + Power Boost surge
    if (braking) {
      this.speedMps -= stats.brakeMps2 * dt;
      this.nitro = Math.min(stats.nitroCapacity, this.nitro + stats.nitroRechargeRate * dt);
    } else if (wantsBoost) {
      this.nitro = Math.max(0, this.nitro - 26 * dt);
      this.speedMps += stats.accelMps2 * 1.65 * dt;
      if (this.speedMps > boostMaxMps) {
        this.speedMps = THREE.MathUtils.damp(this.speedMps, boostMaxMps, 4.0, dt);
      }
    } else {
      // Automatic continuous normal cruising speed & Power gauge recharge
      this.nitro = Math.min(stats.nitroCapacity, this.nitro + stats.nitroRechargeRate * 1.25 * dt);
      if (this.speedMps < normalCruiseMps) {
        const speedRatio = this.speedMps / normalCruiseMps;
        const torqueFactor = Math.max(0.28, 1.1 - speedRatio * 0.78);
        this.speedMps += stats.accelMps2 * torqueFactor * dt;
        if (this.speedMps > normalCruiseMps) this.speedMps = normalCruiseMps;
      } else {
        // Gently settle back to normal cruise speed after boost ends
        this.speedMps = THREE.MathUtils.damp(this.speedMps, normalCruiseMps, 1.8, dt);
      }
    }

    this.speedMps = Math.max(0, this.speedMps);

    // Steering & Realistic Sportbike Counter-Steer Lean (responsive at all speeds)
    const steerInput = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
    const speedAuthority = THREE.MathUtils.clamp(this.speedMps / 10, 0.55, 1.0);
    const targetLatVel = steerInput * stats.lateralSpeed * speedAuthority;
    this.latVel = THREE.MathUtils.damp(this.latVel, targetLatVel, stats.leanDamp, dt);

    this.playerU += this.latVel * dt;
    const maxU = ROAD_HALF_WIDTH - 0.85;
    if (this.playerU < -maxU) {
      this.playerU = -maxU;
      this.latVel = Math.max(0, this.latVel);
      this.speedMps *= Math.pow(0.86, dt * 10);
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.14);
    } else if (this.playerU > maxU) {
      this.playerU = maxU;
      this.latVel = Math.min(0, this.latVel);
      this.speedMps *= Math.pow(0.86, dt * 10);
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.14);
    }

    // Natural lean into left-curving Marine Drive + rider steering lean
    const curveLean = Math.min(0.12, (this.speedMps / 75) * 0.12);
    const targetLean = THREE.MathUtils.clamp(
      -steerInput * stats.maxLeanRad * speedAuthority + curveLean,
      -stats.maxLeanRad,
      stats.maxLeanRad
    );
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, stats.leanDamp, dt);

    // Subtle wheelie pitch under Power Boost or launch acceleration
    const targetPitch = wantsBoost
      ? 0.12
      : !braking && this.speedMps < 34
        ? 0.06
        : braking && this.speedMps > 15
          ? -0.055
          : 0;
    this.wheeliePitch = THREE.MathUtils.damp(this.wheeliePitch, targetPitch, 7.5, dt);

    // Advance along Marine Drive spline
    const ds = this.speedMps * dt;
    this.playerS += ds;
    this.raceElapsed += dt;
    this.playerRig.spinWheels(ds);
    this.playerRig.setBraking(braking);
    this.playerRig.setBoosting(wantsBoost, this.totalElapsed);

    // Track speed & distance score
    const kmh = this.speedMps * 3.6;
    if (kmh > this.topSpeedKmh) this.topSpeedKmh = kmh;
    this.score += ds * (kmh > 160 ? 2.4 : 1.1);

    // Decay near-miss combo & banner timers
    if (this.nearMissComboTimer > 0) {
      this.nearMissComboTimer -= dt;
      if (this.nearMissComboTimer <= 0) this.nearMissCombo = 0;
    }
    if (this.nearMissBannerTimer > 0) {
      this.nearMissBannerTimer -= dt;
      if (this.nearMissBannerTimer <= 0) this.nearMissBanner = null;
    }
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.6);

    // Collision & Near-Miss Detection against Mumbai Traffic
    const bikeHalfW = 0.44;
    const bikeHalfL = 1.08;

    for (const v of this.traffic.vehicles) {
      if (!v.group.visible) continue;
      const dz = Math.abs(v.s - this.playerS);
      const dx = Math.abs(v.u - this.playerU);

      // Direct collision check
      if (
        this.invulnTimer <= 0 &&
        dz < v.halfLength + bikeHalfL * 0.85 &&
        dx < v.halfWidth + bikeHalfW * 0.8
      ) {
        this.hitstopTimer = 0.055; // crisp 55ms impact hitstop
        this.shakeIntensity = 0.65;
        this.invulnTimer = 1.15;
        this.damageFlash = 1.0;
        this.nearMissCombo = 0;
        this.speedMps = Math.max(14, this.speedMps * 0.44);
        // Deflect away from vehicle laterally
        const pushDir = this.playerU >= v.u ? 1 : -1;
        this.playerU = THREE.MathUtils.clamp(this.playerU + pushDir * 1.45, -maxU, maxU);
        this.latVel = pushDir * 5.2;

        this.syncPlayerTransform();
        this.spawnCollisionSparks(this.playerRig.root.position.x, this.playerRig.root.position.z);
        this.audio.playCollision();
        break;
      }

      // Exciting High-Speed Near-Miss Detection!
      if (
        !v.nearMissed &&
        kmh >= 85 &&
        this.playerS > v.s &&
        this.playerS - v.s < v.halfLength + 4.0 &&
        dx < v.halfWidth + 2.05 &&
        dx >= v.halfWidth + bikeHalfW * 0.7
      ) {
        v.nearMissed = true;
        this.nearMissCount++;
        this.nearMissCombo++;
        this.nearMissComboTimer = 4.2;
        const pts = 250 * this.nearMissCombo;
        this.score += pts;
        this.nitro = Math.min(stats.nitroCapacity, this.nitro + 14);
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.14);
        const vehicleLabel =
          v.kind === 'kaali_peeli'
            ? 'Kaali-Peeli'
            : v.kind === 'best_bus'
              ? 'BEST Bus'
              : v.kind === 'auto'
                ? 'Auto'
                : 'Traffic';
        this.nearMissBanner = `Near Miss ${vehicleLabel} +${pts} (x${this.nearMissCombo})`;
        this.nearMissBannerTimer = 1.55;
        this.audio.playNearMiss(this.nearMissCombo, v.kind === 'kaali_peeli' || v.kind === 'best_bus');
      }
    }

    // Check Finish Line at Girgaon Chowpatty (3,600m)
    if (this.playerS >= TRACK_LENGTH) {
      this.finishRace();
    }
  }

  private finishRace(): void {
    this.screen = 'finished';
    this.clearHeldKeys();
    this.isBoosting = false;
    this.playerRig.setBoosting(false, 0);

    const pos = this.traffic.getPlayerPosition(this.playerS);
    const podiumBonus = pos === 1 ? 1600 : pos === 2 ? 1150 : pos === 3 ? 850 : 600;
    const densityMult = this.trafficDensity === 'rush' ? 1.35 : this.trafficDensity === 'light' ? 0.9 : 1.1;
    const creditsEarned = Math.round((podiumBonus + this.nearMissCount * 95) * densityMult);
    const isNewBest = this.bestTimeSec === null || this.raceElapsed < this.bestTimeSec;
    if (isNewBest) this.bestTimeSec = this.raceElapsed;

    this.audio.playFinishFanfare();
    this.callbacks.onScreenChange('finished');
    this.callbacks.onRaceFinish({
      position: pos,
      totalRacers: this.traffic.rivals.length + 1,
      finishTimeSec: this.raceElapsed,
      topSpeedKmh: Math.round(this.topSpeedKmh),
      nearMissCount: this.nearMissCount,
      score: Math.round(this.score),
      creditsEarned,
      isNewBest,
    });
    this.emitTelemetry();
  }

  private updateCamera(dt: number): void {
    sampleTrack(this.playerS, _trackPos, _trackTan, _trackRight);
    const bikeX = this.playerRig.root.position.x;
    const bikeZ = this.playerRig.root.position.z;

    if (this.screen === 'title') {
      // Sweeping atmospheric Nariman Point hero showcase overlooking bike, waves & Queen's Necklace
      const angle = 0.45 + Math.sin(this.totalElapsed * 0.22) * 0.36;
      const dist = 5.4;
      _camTargetPos.set(
        bikeX + Math.sin(angle) * dist + _trackRight.x * 0.8,
        1.95 + Math.sin(this.totalElapsed * 0.35) * 0.14,
        bikeZ + Math.cos(angle) * dist
      );
      // Look past the sportbike down the sweeping Queen's Necklace curve
      _camLookAt.set(
        bikeX + _trackTan.x * 14 - _trackRight.x * 2.2,
        1.15,
        bikeZ + _trackTan.z * 14 - _trackRight.z * 2.2
      );
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 4, dt);
      this.camera.updateProjectionMatrix();
    } else if (this.screen === 'garage') {
      // Interactive 360° studio showcase right on Marine Drive (drag to rotate!)
      if (!this.isDraggingOrbit) {
        this.garageOrbitYaw += dt * 0.16;
      }
      const dist = 4.15;
      const cy = 0.85 + Math.sin(this.garageOrbitPitch) * dist;
      const horiz = Math.cos(this.garageOrbitPitch) * dist;
      _camTargetPos.set(
        bikeX + Math.sin(this.garageOrbitYaw) * horiz,
        Math.max(0.65, cy),
        bikeZ + Math.cos(this.garageOrbitYaw) * horiz
      );
      _camLookAt.set(bikeX, 0.72, bikeZ);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 5, dt);
      this.camera.updateProjectionMatrix();
    } else if (this.screen === 'finished') {
      // Victory celebration orbit at Girgaon Chowpatty Finish Arch
      const a = this.totalElapsed * 0.45;
      _camTargetPos.set(bikeX + Math.sin(a) * 6.2, 2.35, bikeZ + Math.cos(a) * 6.2);
      _camLookAt.set(bikeX, 1.05, bikeZ);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 56, 4, dt);
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'cockpit') {
      // Visor / Helmet Cam right above the glowing TFT dash
      this.playerRig.cockpitAnchor.getWorldPosition(_cockpitWorld);
      this.camera.position.copy(_cockpitWorld);
      _camLookAt.set(
        bikeX + _trackTan.x * 48 + _trackRight.x * (this.latVel * 0.25),
        1.15 + this.wheeliePitch * 2.2,
        bikeZ + _trackTan.z * 48 + _trackRight.z * (this.latVel * 0.25)
      );
      this.camera.lookAt(_camLookAt);
      this.camera.rotateZ(this.leanAngle * 0.36);

      const speedNorm = THREE.MathUtils.clamp(this.speedMps / 75, 0, 1);
      const targetFov = 68 + speedNorm * 16 + (this.isBoosting ? 7 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    } else {
      // Dynamic Third-Person Sportbike Chase Cam with FOV speed stretch & corner banking
      const speedNorm = THREE.MathUtils.clamp(this.speedMps / 78, 0, 1);
      const backDist = 4.95 - speedNorm * 0.35 + (this.isBoosting ? 0.55 : 0);
      const height = 2.02 - speedNorm * 0.14;

      _camTargetPos.set(
        bikeX - _trackTan.x * backDist + _trackRight.x * (this.latVel * 0.045),
        height,
        bikeZ - _trackTan.z * backDist + _trackRight.z * (this.latVel * 0.045)
      );
      _camLookAt.set(
        bikeX + _trackTan.x * 19,
        1.18,
        bikeZ + _trackTan.z * 19
      );

      const targetFov = 60 + speedNorm * 16 + (this.isBoosting ? 8 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    if (!this.camInitialized) {
      this.camCurrentPos.copy(_camTargetPos);
      this.camCurrentLook.copy(_camLookAt);
      this.camInitialized = true;
    } else {
      const posDamp = this.screen === 'racing' ? 12.0 : 5.2;
      const lookDamp = this.screen === 'racing' ? 14.0 : 6.0;
      this.camCurrentPos.x = THREE.MathUtils.damp(this.camCurrentPos.x, _camTargetPos.x, posDamp, dt);
      this.camCurrentPos.y = THREE.MathUtils.damp(this.camCurrentPos.y, _camTargetPos.y, posDamp, dt);
      this.camCurrentPos.z = THREE.MathUtils.damp(this.camCurrentPos.z, _camTargetPos.z, posDamp, dt);

      this.camCurrentLook.x = THREE.MathUtils.damp(this.camCurrentLook.x, _camLookAt.x, lookDamp, dt);
      this.camCurrentLook.y = THREE.MathUtils.damp(this.camCurrentLook.y, _camLookAt.y, lookDamp, dt);
      this.camCurrentLook.z = THREE.MathUtils.damp(this.camCurrentLook.z, _camLookAt.z, lookDamp, dt);
    }

    // Decaying camera shake on impacts & close passes
    let sx = 0;
    let sy = 0;
    if (this.shakeIntensity > 0.004) {
      sx = (Math.random() - 0.5) * this.shakeIntensity;
      sy = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 10, dt);
    }

    this.camera.position.set(this.camCurrentPos.x + sx, this.camCurrentPos.y + sy, this.camCurrentPos.z);
    this.camera.lookAt(this.camCurrentLook);
    if (this.screen === 'racing') {
      this.camera.rotateZ(this.leanAngle * 0.14);
    }
  }

  private getGearAndRpm(): { gear: number; rpmRatio: number } {
    const kmh = this.speedMps * 3.6;
    const gearBounds = [0, 58, 106, 152, 198, 245, 340];
    let gear = 1;
    for (let i = 1; i <= 6; i++) {
      if (kmh < gearBounds[i] || i === 6) {
        gear = i;
        break;
      }
    }
    const low = gearBounds[gear - 1];
    const high = gearBounds[gear];
    const raw = (kmh - low) / Math.max(1, high - low);
    const rpmRatio = THREE.MathUtils.clamp(0.18 + raw * 0.82, 0.14, 1.0);
    return { gear, rpmRatio };
  }

  private emitTelemetry(): void {
    const { gear, rpmRatio } = this.getGearAndRpm();
    const lm = getLandmarkAt(this.playerS);
    this.callbacks.onTelemetry({
      speedKmh: Math.round(this.speedMps * 3.6),
      rpmRatio,
      gear,
      nitro: Math.round(this.nitro),
      isBoosting: this.isBoosting,
      progress: THREE.MathUtils.clamp(this.playerS / TRACK_LENGTH, 0, 1),
      distanceM: Math.min(TRACK_LENGTH, Math.max(0, Math.round(this.playerS))),
      elapsedSec: this.raceElapsed,
      position: this.traffic.getPlayerPosition(this.playerS),
      totalRacers: this.traffic.rivals.length + 1,
      score: Math.round(this.score),
      nearMissCount: this.nearMissCount,
      nearMissCombo: this.nearMissCombo,
      nearMissBanner: this.nearMissBanner,
      landmarkName: lm.name,
      countdownValue: this.screen === 'countdown' ? Math.ceil(this.countdownTimer) : 0,
      topSpeedKmh: Math.round(this.topSpeedKmh),
      rivals: this.traffic.getRivalMarkers(),
      wrongWay: false,
      damageFlash: this.damageFlash,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.screen !== 'paused') {
      this.totalElapsed += dt;

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        if (this.screen === 'countdown') {
          this.countdownTimer -= dt;
          const nextInt = Math.ceil(this.countdownTimer);
          if (nextInt < this.lastCountdownInt && nextInt >= 1) {
            this.lastCountdownInt = nextInt;
            this.audio.playCountdownBeep(false);
            this.emitTelemetry();
          }
          if (this.countdownTimer <= 0) {
            this.screen = 'racing';
            this.audio.playCountdownBeep(true);
            this.callbacks.onScreenChange('racing');
            this.emitTelemetry();
          }
          this.traffic.update(dt, this.totalElapsed, this.playerS, false);
        } else if (this.screen === 'racing') {
          this.stepPhysics(dt);
          this.traffic.update(dt, this.totalElapsed, this.playerS, true);
        } else if (this.screen === 'finished') {
          // Coast smoothly past Girgaon Chowpatty finish arch
          this.speedMps = THREE.MathUtils.damp(this.speedMps, 0, 1.4, dt);
          this.playerS += this.speedMps * dt;
          this.leanAngle = THREE.MathUtils.damp(this.leanAngle, 0, 4, dt);
          this.wheeliePitch = THREE.MathUtils.damp(this.wheeliePitch, 0, 5, dt);
          this.playerRig.spinWheels(this.speedMps * dt);
          this.traffic.update(dt, this.totalElapsed, this.playerS, false);
        } else {
          // Title / Garage ambient traffic moving gently in background
          this.traffic.update(dt * 0.4, this.totalElapsed, this.playerS, false);
        }

        this.syncPlayerTransform();
        this.updateSparks(dt);
        this.environment.update(dt, this.playerRig.root.position);
        this.ocean.update(dt, this.totalElapsed, this.playerS, this.camera.position);
        this.updateCamera(dt);

        // Audio continuous update
        const { gear, rpmRatio } = this.getGearAndRpm();
        const revvingOnGrid = this.screen === 'countdown' && (this.held.up || this.touchInput.power);
        this.audio.updateContinuous(
          this.screen === 'racing' || revvingOnGrid,
          revvingOnGrid ? 35 : this.speedMps * 3.6,
          revvingOnGrid ? 0.52 + Math.sin(this.totalElapsed * 14) * 0.14 : rpmRatio,
          gear,
          this.isBoosting,
          this.totalElapsed
        );
      }

      // Throttled HUD update (~18Hz) so React never slows down WebGL
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.055 && (this.screen === 'racing' || this.screen === 'countdown')) {
        this.hudEmitAccum = 0;
        this.emitTelemetry();
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private clearHeldKeys(): void {
    this.held.up = false;
    this.held.down = false;
    this.held.left = false;
    this.held.right = false;
    this.held.nitro = false;
    this.touchInput.left = false;
    this.touchInput.right = false;
    this.touchInput.power = false;
    this.touchInput.brake = false;
    this.touchInput.nitro = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      if (this.screen === 'racing' || this.screen === 'countdown') e.preventDefault();
      this.held.up = true;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') {
      if (this.screen === 'racing' || this.screen === 'countdown') e.preventDefault();
      this.held.down = true;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') {
      if (this.screen === 'racing' || this.screen === 'countdown') e.preventDefault();
      this.held.left = true;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') {
      if (this.screen === 'racing' || this.screen === 'countdown') e.preventDefault();
      this.held.right = true;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
      if (this.screen === 'racing' || this.screen === 'countdown') {
        e.preventDefault();
        this.held.nitro = true;
      }
    }
    if (e.repeat) return;

    if (e.code === 'KeyC' && (this.screen === 'racing' || this.screen === 'countdown')) {
      this.toggleCameraMode();
    }
    if (e.code === 'Escape') {
      if (this.screen === 'racing') this.pauseRace();
      else if (this.screen === 'paused') this.resumeRace();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      this.held.up = false;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S') {
      this.held.down = false;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.held.left = false;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD' || k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.held.right = false;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
      this.held.nitro = false;
    }
  };

  private onBlur = (): void => {
    this.clearHeldKeys();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.screen !== 'garage') return;
    this.isDraggingOrbit = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDraggingOrbit || this.screen !== 'garage') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.garageOrbitYaw -= dx * 0.008;
    this.garageOrbitPitch = THREE.MathUtils.clamp(this.garageOrbitPitch + dy * 0.005, 0.06, 0.65);
  };

  private onPointerUp = (): void => {
    this.isDraggingOrbit = false;
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private onWebglLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onWebglRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onWebglLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onWebglRestored);

    this.audio.dispose();
    this.environment.dispose();
    this.ocean.dispose();
    this.traffic.dispose();
    this.textures.dispose();
    this.envRT.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
