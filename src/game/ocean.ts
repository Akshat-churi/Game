import * as THREE from 'three';
import { sampleTrack, TRACK_END_BUFFER, TRACK_START_BUFFER } from './track';
import type { TimeOfDay } from './types';

interface OceanUniforms {
  uTime: { value: number };
  uNightFactor: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

interface SprayParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();
const _dummy = new THREE.Object3D();

/**
 * High-fidelity Arabian Sea Ocean & Coastal Surf System
 * - Follows Back Bay's sweeping C-curve from Nariman Point to Girgaon Chowpatty
 * - Uses MeshStandardMaterial + onBeforeCompile for multi-octave Gerstner swells,
 *   analytical wave normals, shallow turquoise-to-indigo depth color, animated
 *   shoreline breaking surf foam, and warm Queen's Necklace night reflections!
 * - Pooled 3D sea-spray bursts splash over the tetrapods near the player.
 */
export class ArabianSeaSystem {
  public readonly group = new THREE.Group();
  private oceanMaterial: THREE.MeshStandardMaterial;
  private uniforms: OceanUniforms;
  private sprayMesh: THREE.InstancedMesh;
  private sprayParticles: SprayParticle[] = [];
  private sprayTimer = 0;

  constructor(haloTexture: THREE.CanvasTexture) {
    this.uniforms = {
      uTime: { value: 0 },
      uNightFactor: { value: 1 },
      uSunDir: { value: new THREE.Vector3(-0.75, 0.34, -0.55).normalize() },
    };

    // Build curved Back Bay ocean mesh hugging the coastline (-13.5m out to -580m into Arabian Sea)
    const lengthSegs = 220;
    const widthSegs = 36;
    const vertCount = (lengthSegs + 1) * (widthSegs + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    const sMin = TRACK_START_BUFFER - 180;
    const sMax = TRACK_END_BUFFER + 280;

    let vIdx = 0;
    for (let i = 0; i <= lengthSegs; i++) {
      const tL = i / lengthSegs;
      const s = sMin + tL * (sMax - sMin);
      sampleTrack(s, _pos, _tan, _right);

      for (let j = 0; j <= widthSegs; j++) {
        const tW = j / widthSegs; // 0 = shoreline (-13.5m), 1 = deep Arabian Sea (-620m)
        // Exponential lateral spacing: dense detail near tetrapods & surf, wide expanse to horizon
        const shoreDist = Math.pow(tW, 2.05) * 620;
        const u = -13.2 - shoreDist;

        positions[vIdx * 3] = _pos.x + _right.x * u;
        positions[vIdx * 3 + 1] = -0.95;
        positions[vIdx * 3 + 2] = _pos.z + _right.z * u;

        uvs[vIdx * 2] = s * 0.012; // along coast
        uvs[vIdx * 2 + 1] = shoreDist; // exact meters from shoreline!
        vIdx++;
      }
    }

    for (let i = 0; i < lengthSegs; i++) {
      for (let j = 0; j < widthSegs; j++) {
        const a = i * (widthSegs + 1) + j;
        const b = a + 1;
        const c = (i + 1) * (widthSegs + 1) + j;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const oceanGeo = new THREE.BufferGeometry();
    oceanGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    oceanGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    oceanGeo.setIndex(indices);
    oceanGeo.computeVertexNormals();

    this.oceanMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c4a6e'),
      roughness: 0.14,
      metalness: 0.22,
      envMapIntensity: 1.35,
    });

    const uniformsRef = this.uniforms;
    this.oceanMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniformsRef.uTime;
      shader.uniforms.uNightFactor = uniformsRef.uNightFactor;
      shader.uniforms.uSunDir = uniformsRef.uSunDir;

      shader.vertexShader =
        `
        uniform float uTime;
        varying float vShoreDist;
        varying float vWaveCrest;
        varying vec3 vOceanWorldPos;
        varying vec2 vWaveSlope;
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vShoreDist = uv.y;
        vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz;

        // Multi-directional Arabian Sea swells rolling toward Mumbai's shoreline
        float p1 = wp0.x * 0.048 + wp0.z * 0.032 - uTime * 1.65;
        float p2 = wp0.x * 0.092 - wp0.z * 0.068 - uTime * 2.15;
        float p3 = uv.y * 0.24 + uTime * 2.65 + sin(uv.x * 3.1) * 0.9;
        float p4 = wp0.x * 0.17 + wp0.z * 0.14 - uTime * 2.95;

        float shoreAtten = smoothstep(0.0, 26.0, uv.y);
        float swell =
          sin(p1) * 0.42 * shoreAtten +
          sin(p2) * 0.24 * shoreAtten +
          sin(p3) * 0.34 * (1.0 - smoothstep(12.0, 95.0, uv.y)) +
          cos(p4) * 0.11;

        transformed.y += swell;
        vWaveCrest = clamp((swell + 0.35) * 0.9, 0.0, 1.4);

        // Analytical surface slope for realistic crisp water normal glints
        float ddx = cos(p1) * 0.048 * 0.42 + cos(p2) * 0.092 * 0.24 - sin(p4) * 0.17 * 0.11;
        float ddz = cos(p1) * 0.032 * 0.42 - cos(p2) * 0.068 * 0.24 - sin(p4) * 0.14 * 0.11;
        vWaveSlope = vec2(ddx, ddz);
        vOceanWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      shader.fragmentShader =
        `
        uniform float uTime;
        uniform float uNightFactor;
        uniform vec3 uSunDir;
        varying float vShoreDist;
        varying float vWaveCrest;
        varying vec3 vOceanWorldPos;
        varying vec2 vWaveSlope;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        // Day coastal palette: shallow turquoise surf -> deep cobalt Arabian Sea
        vec3 dayShallow = vec3(0.07, 0.48, 0.56);
        vec3 dayDeep = vec3(0.03, 0.19, 0.36);
        vec3 dayBase = mix(dayShallow, dayDeep, smoothstep(4.0, 95.0, vShoreDist));

        // Night coastal palette: dark slate-indigo Arabian Sea
        vec3 nightShallow = vec3(0.03, 0.09, 0.16);
        vec3 nightDeep = vec3(0.012, 0.032, 0.075);
        vec3 nightBase = mix(nightShallow, nightDeep, smoothstep(5.0, 85.0, vShoreDist));

        vec3 waterCol = mix(dayBase, nightBase, uNightFactor);

        // Animated breaking surf foam bands rolling onto the tetrapods & beach
        float foamPhase1 = sin(vShoreDist * 0.46 + uTime * 2.85 + sin(vOceanWorldPos.z * 0.055) * 2.1);
        float foamPhase2 = sin(vShoreDist * 0.92 + uTime * 3.6 - vOceanWorldPos.x * 0.04);
        float shoreMask = 1.0 - smoothstep(1.0, 24.0, vShoreDist);
        float shoreFoam = smoothstep(0.32, 0.85, foamPhase1 * 0.65 + foamPhase2 * 0.35 + shoreMask * 0.55) * shoreMask;

        // Open-water subtle whitecap crests
        float openCaps = smoothstep(0.88, 1.24, vWaveCrest + foamPhase2 * 0.14) * 0.32;
        float totalFoam = clamp(shoreFoam + openCaps, 0.0, 1.0);

        vec3 foamColor = mix(vec3(0.92, 0.96, 0.99), vec3(0.34, 0.42, 0.52), uNightFactor);
        diffuseColor.rgb = mix(waterCol, foamColor, totalFoam);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        vec3 viewDirW = normalize(cameraPosition - vOceanWorldPos);
        vec3 waveNorm = normalize(vec3(
          -vWaveSlope.x * 2.6 + sin(vOceanWorldPos.x * 0.25 + uTime * 2.1) * 0.06,
          1.0,
          -vWaveSlope.y * 2.6 + cos(vOceanWorldPos.z * 0.22 - uTime * 1.9) * 0.06
        ));
        float fresnel = pow(1.0 - max(dot(viewDirW, waveNorm), 0.0), 3.6);

        // Sun / Moon directional glitter ribbon on the Arabian Sea
        vec3 halfVec = normalize(uSunDir + viewDirW);
        float specGlint = pow(max(dot(waveNorm, halfVec), 0.0), 72.0);
        vec3 dayGlint = vec3(1.0, 0.88, 0.65) * specGlint * 1.55;
        vec3 moonGlint = vec3(0.58, 0.72, 0.96) * specGlint * 0.62;

        // Iconic warm golden Queen's Necklace promenade reflection shimmer along the water at night!
        float coastReflectMask = (1.0 - smoothstep(2.0, 68.0, vShoreDist)) * uNightFactor;
        float shimmer = 0.55 + 0.45 * sin(vOceanWorldPos.z * 0.35 + vOceanWorldPos.x * 0.28 + uTime * 3.8);
        float rippleBreak = smoothstep(0.15, 0.92, shimmer * (0.6 + fresnel * 0.8));
        vec3 necklaceGlow = vec3(1.0, 0.62, 0.16) * coastReflectMask * rippleBreak * 0.72;

        // Sky fresnel reflection tint
        vec3 skyTint = mix(vec3(0.35, 0.62, 0.86) * 0.24, vec3(0.08, 0.15, 0.28) * 0.3, uNightFactor);

        totalEmissiveRadiance += mix(dayGlint, moonGlint, uNightFactor) + necklaceGlow + skyTint * fresnel;
        `
      );
    };

    const oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMaterial);
    oceanMesh.receiveShadow = false;
    oceanMesh.frustumCulled = false;
    this.group.add(oceanMesh);

    // Distant deep sea apron extending to horizon so no seam is ever visible
    const horizonGeo = new THREE.PlaneGeometry(5200, 5200);
    horizonGeo.rotateX(-Math.PI / 2);
    const horizonMat = new THREE.MeshBasicMaterial({ color: '#08182e' });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    horizonMesh.position.set(-1950, -1.6, -1800);
    horizonMesh.name = 'horizonSea';
    this.group.add(horizonMesh);

    // Pooled 3D Coastal Sea Spray Particles splashing over tetrapods
    const sprayCount = 110;
    const sprayGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const sprayMat = new THREE.MeshBasicMaterial({
      map: haloTexture,
      color: new THREE.Color('#dceeff'),
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.sprayMesh = new THREE.InstancedMesh(sprayGeo, sprayMat, sprayCount);
    this.sprayMesh.frustumCulled = false;
    this.sprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < sprayCount; i++) {
      this.sprayParticles.push({
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.sprayMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sprayMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.sprayMesh);
  }

  public setTimeOfDay(mode: TimeOfDay): void {
    const isNight = mode === 'night';
    this.uniforms.uNightFactor.value = isNight ? 1.0 : 0.0;
    if (isNight) {
      this.uniforms.uSunDir.value.set(-0.72, 0.28, -0.62).normalize();
      (this.sprayMesh.material as THREE.MeshBasicMaterial).color.set('#9ab4d6');
      (this.sprayMesh.material as THREE.MeshBasicMaterial).opacity = 0.26;
    } else {
      this.uniforms.uSunDir.value.set(-0.8, 0.42, -0.45).normalize();
      (this.sprayMesh.material as THREE.MeshBasicMaterial).color.set('#f0f8ff');
      (this.sprayMesh.material as THREE.MeshBasicMaterial).opacity = 0.52;
    }
    const horizon = this.group.getObjectByName('horizonSea') as THREE.Mesh | undefined;
    if (horizon) {
      (horizon.material as THREE.MeshBasicMaterial).color.set(isNight ? '#061022' : '#18548a');
    }
  }

  public update(dt: number, elapsed: number, playerS: number, cameraPos: THREE.Vector3): void {
    this.uniforms.uTime.value = elapsed;

    // Periodically spawn coastal wave spray bursts against tetrapods ahead of the player
    this.sprayTimer -= dt;
    if (this.sprayTimer <= 0 && playerS < 2920) {
      this.sprayTimer = 0.28 + Math.random() * 0.35;
      const splashS = playerS + 22 + Math.random() * 88;
      if (splashS < 2950) {
        sampleTrack(splashS, _pos, _tan, _right);
        const baseX = _pos.x + _right.x * -15.4;
        const baseZ = _pos.z + _right.z * -15.4;

        let spawned = 0;
        for (let i = 0; i < this.sprayParticles.length && spawned < 9; i++) {
          const p = this.sprayParticles[i];
          if (p.life <= 0) {
            p.x = baseX + (Math.random() - 0.5) * 4.5;
            p.y = 0.2 + Math.random() * 0.5;
            p.z = baseZ + (Math.random() - 0.5) * 4.5;
            // Spray kicks upward and slightly inland over the parapet
            p.vx = _right.x * (1.5 + Math.random() * 2.8) + (Math.random() - 0.5) * 1.4;
            p.vy = 3.2 + Math.random() * 3.4;
            p.vz = _right.z * (1.5 + Math.random() * 2.8) + (Math.random() - 0.5) * 1.4;
            p.maxLife = 0.75 + Math.random() * 0.55;
            p.life = p.maxLife;
            p.scale = 0.6 + Math.random() * 1.25;
            spawned++;
          }
        }
      }
    }

    // Integrate active spray particles & billboard toward camera
    let dirty = false;
    for (let i = 0; i < this.sprayParticles.length; i++) {
      const p = this.sprayParticles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 7.8 * dt;

        const ratio = Math.max(0, p.life / p.maxLife);
        const s = p.scale * (1.45 - ratio * 0.65) * Math.sin(ratio * Math.PI);
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.lookAt(cameraPos);
        _dummy.scale.setScalar(Math.max(0.001, s));
        _dummy.updateMatrix();
        this.sprayMesh.setMatrixAt(i, _dummy.matrix);
        dirty = true;
      }
    }
    if (dirty) {
      this.sprayMesh.instanceMatrix.needsUpdate = true;
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
