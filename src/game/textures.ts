import * as THREE from 'three';

export interface ProceduralTexturePack {
  roadAlbedo: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  promenadeAlbedo: THREE.CanvasTexture;
  sandAlbedo: THREE.CanvasTexture;
  artDecoDay: THREE.CanvasTexture;
  artDecoEmissive: THREE.CanvasTexture;
  towerDay: THREE.CanvasTexture;
  towerEmissive: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  lightHalo: THREE.CanvasTexture;
  daySky: THREE.CanvasTexture;
  nightSky: THREE.CanvasTexture;
  startBanner: THREE.CanvasTexture;
  finishBanner: THREE.CanvasTexture;
  tireTread: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTexturePack {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);

  // 1. Marine Drive 4-Lane Coastal Asphalt (Albedo + Roughness)
  const [roadC, roadCtx] = makeCanvas(512, 512);
  roadCtx.fillStyle = '#242933';
  roadCtx.fillRect(0, 0, 512, 512);

  // Asphalt aggregate micro-grain
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 26 + Math.floor(Math.random() * 28);
    roadCtx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
    roadCtx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear polish in each of the 4 lanes
  const laneX = [82, 198, 314, 430];
  laneX.forEach((lx) => {
    const grad = roadCtx.createLinearGradient(lx - 32, 0, lx + 32, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(10,12,18,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    roadCtx.fillStyle = grad;
    roadCtx.fillRect(lx - 32, 0, 64, 512);
  });

  // Left & Right coastal road shoulder lines (crisp white + weathered curb border)
  roadCtx.fillStyle = '#474f5c';
  roadCtx.fillRect(0, 0, 14, 512);
  roadCtx.fillRect(498, 0, 14, 512);

  roadCtx.fillStyle = '#d7dde6';
  roadCtx.fillRect(20, 0, 6, 512);
  roadCtx.fillRect(486, 0, 6, 512);

  // Center double amber-gold Marine Drive divider
  roadCtx.fillStyle = '#e5a922';
  roadCtx.fillRect(250, 0, 4, 512);
  roadCtx.fillRect(258, 0, 4, 512);

  // Dashed lane dividers between inner & outer lanes
  roadCtx.fillStyle = '#e2e8f0';
  for (let y = 16; y < 512; y += 96) {
    roadCtx.fillRect(136, y, 5, 50);
    roadCtx.fillRect(371, y, 5, 50);
  }

  const roadAlbedo = configureTexture(roadC, maxAniso, true, 1, 1);

  // Road Roughness Map (subtle damp sea-mist tire tracks for realistic night lamp reflections)
  const [rRoughC, rRoughCtx] = makeCanvas(256, 256);
  rRoughCtx.fillStyle = '#b4b4b4';
  rRoughCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const v = 135 + Math.floor(Math.random() * 80);
    rRoughCtx.fillStyle = `rgb(${v},${v},${v})`;
    rRoughCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Slightly glossier coastal damp patches & tire paths
  [41, 99, 157, 215].forEach((lx) => {
    const g = rRoughCtx.createLinearGradient(lx - 18, 0, lx + 18, 0);
    g.addColorStop(0, 'rgba(180,180,180,0)');
    g.addColorStop(0.5, 'rgba(72,72,72,0.55)');
    g.addColorStop(1, 'rgba(180,180,180,0)');
    rRoughCtx.fillStyle = g;
    rRoughCtx.fillRect(lx - 18, 0, 36, 256);
  });
  const roadRoughness = configureTexture(rRoughC, maxAniso, false, 1, 1);

  // 2. Marine Drive Promenade Stone Paving
  const [promC, promCtx] = makeCanvas(256, 256);
  promCtx.fillStyle = '#9b968d';
  promCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const jitter = ((x * 7 + y * 13) % 16) - 8;
      promCtx.fillStyle = `rgb(${152 + jitter},${146 + jitter},${136 + jitter})`;
      promCtx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  const promenadeAlbedo = configureTexture(promC, maxAniso, true, 1, 1);

  // 3. Girgaon Chowpatty Golden Sand
  const [sandC, sandCtx] = makeCanvas(256, 256);
  sandCtx.fillStyle = '#c4a476';
  sandCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const d = Math.floor(Math.random() * 34) - 17;
    sandCtx.fillStyle = `rgb(${194 + d},${162 + d},${116 + d})`;
    sandCtx.fillRect(x, y, 2, 2);
  }
  const sandAlbedo = configureTexture(sandC, maxAniso, true, 4, 24);

  // 4. Mumbai Art Deco Heritage Building Facade (Day + Emissive Window Grid)
  const [decoC, decoCtx] = makeCanvas(512, 512);
  const [decoEmC, decoEmCtx] = makeCanvas(512, 512);
  decoCtx.fillStyle = '#dfd5c3';
  decoCtx.fillRect(0, 0, 512, 512);
  decoEmCtx.fillStyle = '#000000';
  decoEmCtx.fillRect(0, 0, 512, 512);

  // Horizontal Art Deco architectural bands & balconies
  const floors = 8;
  const floorH = 512 / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * floorH;
    // Balcony slab shadow & cream railing
    decoCtx.fillStyle = '#c8baa2';
    decoCtx.fillRect(0, y + floorH - 14, 512, 14);
    decoCtx.fillStyle = '#efe7d8';
    decoCtx.fillRect(0, y + floorH - 18, 512, 5);
    // Decorative horizontal Deco trim stripe
    decoCtx.fillStyle = '#8b7355';
    decoCtx.fillRect(0, y + 2, 512, 3);

    // Windows across floor
    const cols = 6;
    const colW = 512 / cols;
    for (let c = 0; c < cols; c++) {
      const wx = c * colW + 12;
      const wy = y + 12;
      const ww = colW - 24;
      const wh = floorH - 34;

      // Day glass with shutter trim
      decoCtx.fillStyle = '#2d3b4c';
      decoCtx.fillRect(wx, wy, ww, wh);
      decoCtx.strokeStyle = '#f3ece0';
      decoCtx.lineWidth = 2;
      decoCtx.strokeRect(wx, wy, ww, wh);

      // Night window illumination (warm residential amber/ivory with realistic occupancy)
      const seed = Math.sin(f * 19.3 + c * 7.7) * 43758.5453;
      const frac = seed - Math.floor(seed);
      if (frac > 0.34) {
        const warm = frac > 0.78 ? '#ffd384' : frac > 0.52 ? '#ffb85c' : '#e6eef8';
        decoEmCtx.fillStyle = warm;
        decoEmCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }
  const artDecoDay = configureTexture(decoC, maxAniso, true, 1, 1);
  const artDecoEmissive = configureTexture(decoEmC, maxAniso, true, 1, 1);

  // 5. Nariman Point / Malabar Hill Modern Skyscraper Facade (Day + Night Emissive)
  const [twC, twCtx] = makeCanvas(512, 512);
  const [twEmC, twEmCtx] = makeCanvas(512, 512);
  twCtx.fillStyle = '#334155';
  twCtx.fillRect(0, 0, 512, 512);
  twEmCtx.fillStyle = '#000000';
  twEmCtx.fillRect(0, 0, 512, 512);

  const tRows = 16;
  const tCols = 10;
  const trH = 512 / tRows;
  const tcW = 512 / tCols;
  for (let r = 0; r < tRows; r++) {
    // Structural spandrel beam
    twCtx.fillStyle = '#64748b';
    twCtx.fillRect(0, r * trH, 512, 6);
    for (let c = 0; c < tCols; c++) {
      const x = c * tcW + 4;
      const y = r * trH + 8;
      const w = tcW - 8;
      const h = trH - 11;
      twCtx.fillStyle = '#1e293b';
      twCtx.fillRect(x, y, w, h);

      const hval = Math.sin(r * 31.7 + c * 17.3) * 12345.67;
      const f = hval - Math.floor(hval);
      if (f > 0.42) {
        twEmCtx.fillStyle = f > 0.8 ? '#ffcb70' : f > 0.62 ? '#fff0cf' : '#93c5fd';
        twEmCtx.fillRect(x + 1, y + 1, w - 2, h - 2);
      }
    }
  }
  const towerDay = configureTexture(twC, maxAniso, true, 1, 1);
  const towerEmissive = configureTexture(twEmC, maxAniso, true, 1, 1);

  // 6. Soft Radial Contact Shadow
  const [shC, shCtx] = makeCanvas(128, 128);
  const shGrad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  shGrad.addColorStop(0.55, 'rgba(0,0,0,0.42)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shC);
  contactShadow.needsUpdate = true;

  // 7. Additive Light Halo Sprite (Queen's Necklace sodium glow & headlights)
  const [hlC, hlCtx] = makeCanvas(128, 128);
  const hlGrad = hlCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
  hlGrad.addColorStop(0, 'rgba(255,248,225,1)');
  hlGrad.addColorStop(0.22, 'rgba(255,205,110,0.82)');
  hlGrad.addColorStop(0.55, 'rgba(245,158,11,0.24)');
  hlGrad.addColorStop(1, 'rgba(245,158,11,0)');
  hlCtx.fillStyle = hlGrad;
  hlCtx.fillRect(0, 0, 128, 128);
  const lightHalo = new THREE.CanvasTexture(hlC);
  lightHalo.colorSpace = THREE.SRGBColorSpace;
  lightHalo.needsUpdate = true;

  // 8. Day Sky Dome Texture (Vibrant Mumbai Coastal Golden Afternoon)
  const [dsC, dsCtx] = makeCanvas(512, 256);
  const dsGrad = dsCtx.createLinearGradient(0, 0, 0, 256);
  dsGrad.addColorStop(0.0, '#1e60a8');
  dsGrad.addColorStop(0.32, '#4992d6');
  dsGrad.addColorStop(0.54, '#a6d2f0');
  dsGrad.addColorStop(0.68, '#f7dbb6');
  dsGrad.addColorStop(0.82, '#e2be96');
  dsGrad.addColorStop(1.0, '#7c9eb8');
  dsCtx.fillStyle = dsGrad;
  dsCtx.fillRect(0, 0, 512, 256);

  // Soft sunlit coastal cirrus wisps
  dsCtx.fillStyle = 'rgba(255,250,240,0.22)';
  for (let i = 0; i < 26; i++) {
    const cx = (i * 47) % 512;
    const cy = 62 + (i % 5) * 14;
    dsCtx.beginPath();
    dsCtx.ellipse(cx, cy, 48 + (i % 3) * 22, 6 + (i % 2) * 4, 0, 0, Math.PI * 2);
    dsCtx.fill();
  }
  const daySky = new THREE.CanvasTexture(dsC);
  daySky.colorSpace = THREE.SRGBColorSpace;
  daySky.needsUpdate = true;

  // 9. Night Sky Dome Texture (Mumbai Coastal Indigo + Warm Horizon Glow + Stars)
  const [nsC, nsCtx] = makeCanvas(512, 256);
  const nsGrad = nsCtx.createLinearGradient(0, 0, 0, 256);
  nsGrad.addColorStop(0.0, '#040814');
  nsGrad.addColorStop(0.36, '#09142b');
  nsGrad.addColorStop(0.58, '#132347');
  nsGrad.addColorStop(0.72, '#2a2b46');
  nsGrad.addColorStop(0.84, '#3d2c36');
  nsGrad.addColorStop(1.0, '#0b1020');
  nsCtx.fillStyle = nsGrad;
  nsCtx.fillRect(0, 0, 512, 256);

  // Subtle stars in upper dome
  for (let i = 0; i < 190; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 125;
    const alpha = 0.25 + Math.random() * 0.7;
    nsCtx.fillStyle = `rgba(225,238,255,${alpha})`;
    nsCtx.fillRect(sx, sy, 1.5, 1.5);
  }
  const nightSky = new THREE.CanvasTexture(nsC);
  nightSky.colorSpace = THREE.SRGBColorSpace;
  nightSky.needsUpdate = true;

  // 10. Start & Finish Gantry Banners
  const makeBanner = (title: string, subtitle: string, accent: string, checkered: boolean) => {
    const [bc, bctx] = makeCanvas(1024, 192);
    bctx.fillStyle = '#0d1424';
    bctx.fillRect(0, 0, 1024, 192);
    bctx.fillStyle = accent;
    bctx.fillRect(0, 0, 1024, 12);
    bctx.fillRect(0, 180, 1024, 12);

    if (checkered) {
      for (let x = 0; x < 140; x += 20) {
        for (let y = 12; y < 180; y += 20) {
          const on = ((x / 20 + y / 20) & 1) === 0;
          bctx.fillStyle = on ? '#f8fafc' : '#0f172a';
          bctx.fillRect(x, y, 20, 20);
          bctx.fillRect(1024 - 140 + x, y, 20, 20);
        }
      }
    }

    bctx.fillStyle = '#f8fafc';
    bctx.font = '800 62px "Oxanium", sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(title, 512, 78);

    bctx.fillStyle = accent;
    bctx.font = '600 30px "Plus Jakarta Sans", sans-serif';
    bctx.fillText(subtitle, 512, 140);

    const tex = new THREE.CanvasTexture(bc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
    return tex;
  };

  const startBanner = makeBanner('NARIMAN POINT', 'MARINE DRIVE GP · 3.6 KM COASTAL SPRINT', '#f59e0b', false);
  const finishBanner = makeBanner('GIRGAON CHOWPATTY', 'FINISH LINE · QUEEN’S NECKLACE', '#10b981', true);

  // 11. Sportbike Tire Tread
  const [trC, trCtx] = makeCanvas(128, 128);
  trCtx.fillStyle = '#16181e';
  trCtx.fillRect(0, 0, 128, 128);
  trCtx.strokeStyle = '#0a0b0e';
  trCtx.lineWidth = 4;
  for (let y = 0; y < 128; y += 16) {
    trCtx.beginPath();
    trCtx.moveTo(64, y);
    trCtx.lineTo(14, y + 12);
    trCtx.moveTo(64, y);
    trCtx.lineTo(114, y + 12);
    trCtx.stroke();
  }
  const tireTread = configureTexture(trC, maxAniso, true, 1, 6);

  const all = [
    roadAlbedo,
    roadRoughness,
    promenadeAlbedo,
    sandAlbedo,
    artDecoDay,
    artDecoEmissive,
    towerDay,
    towerEmissive,
    contactShadow,
    lightHalo,
    daySky,
    nightSky,
    startBanner,
    finishBanner,
    tireTread,
  ];

  return {
    roadAlbedo,
    roadRoughness,
    promenadeAlbedo,
    sandAlbedo,
    artDecoDay,
    artDecoEmissive,
    towerDay,
    towerEmissive,
    contactShadow,
    lightHalo,
    daySky,
    nightSky,
    startBanner,
    finishBanner,
    tireTread,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
