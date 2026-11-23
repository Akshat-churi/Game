/**
 * Procedural Web Audio Engine for Marine Drive GP
 * - Inline-4 sportbike engine synth (fundamental + exhaust harmonic + filter)
 * - Coastal Arabian Sea surf & speed wind ambience
 * - Nitro turbine whoosh
 * - Near-miss Doppler pass & authentic Mumbai dual-tone taxi horn
 * - Collision impact, countdown beeps, and victory chime
 */
export class RaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Continuous engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Wind + surf ambience
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Nitro jet hiss
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;

  private muted = false;
  private initialized = false;
  private lastGear = 1;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.42;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Inline-4 Engine Synth
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 65;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 130;

      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineFilter.Q.value = 2.4;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;

      osc1.connect(engineFilter);
      osc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);

      osc1.start();
      osc2.start();

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = engineFilter;
      this.engineGain = engineGain;

      // Shared white noise buffer for ocean surf, wind, and nitro
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // Coastal wind + surf
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 320;
      windFilter.Q.value = 0.7;

      const windGain = ctx.createGain();
      windGain.gain.value = 0.035;

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();

      this.windFilter = windFilter;
      this.windGain = windGain;

      // Nitro whoosh layer
      const nitroSource = ctx.createBufferSource();
      nitroSource.buffer = noiseBuffer;
      nitroSource.loop = true;

      const nitroFilter = ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 1200;
      nitroFilter.Q.value = 1.6;

      const nitroGain = ctx.createGain();
      nitroGain.gain.value = 0.0;

      nitroSource.connect(nitroFilter);
      nitroFilter.connect(nitroGain);
      nitroGain.connect(master);
      nitroSource.start();

      this.nitroFilter = nitroFilter;
      this.nitroGain = nitroGain;

      this.initialized = true;
    } catch {
      // Ignore if audio context blocked
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateContinuous(
    active: boolean,
    speedKmh: number,
    rpmRatio: number,
    gear: number,
    boosting: boolean,
    elapsedSec: number
  ): void {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (!active) {
      this.engineGain?.gain.setTargetAtTime(0.0, now, 0.12);
      this.nitroGain?.gain.setTargetAtTime(0.0, now, 0.1);
      // Gentle coastal Arabian Sea surf swell on title/garage
      const surfWave = 0.025 + Math.sin(elapsedSec * 0.85) * 0.012;
      this.windGain?.gain.setTargetAtTime(surfWave, now, 0.15);
      this.windFilter?.frequency.setTargetAtTime(240 + Math.sin(elapsedSec * 0.85) * 80, now, 0.15);
      return;
    }

    // Brief exhaust pop on upshift
    if (gear > this.lastGear && speedKmh > 60) {
      this.playShiftPop();
    }
    this.lastGear = gear;

    // Inline-4 sportbike frequency profile (70Hz idle -> 310Hz redline shriek)
    const baseFreq = 62 + rpmRatio * 215 + (boosting ? 32 : 0);
    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.995, now, 0.03);
    this.engineFilter?.frequency.setTargetAtTime(
      340 + rpmRatio * 1850 + (boosting ? 600 : 0),
      now,
      0.04
    );

    const engVol = 0.075 + Math.min(1, speedKmh / 240) * 0.085 + (boosting ? 0.03 : 0);
    this.engineGain?.gain.setTargetAtTime(engVol, now, 0.05);

    // Coastal wind rush scales with speed
    const speedNorm = Math.min(1, speedKmh / 280);
    this.windGain?.gain.setTargetAtTime(0.022 + speedNorm * 0.085, now, 0.08);
    this.windFilter?.frequency.setTargetAtTime(260 + speedNorm * 1150, now, 0.08);

    // Nitro jet sound
    this.nitroGain?.gain.setTargetAtTime(boosting ? 0.12 : 0.0, now, 0.05);
    this.nitroFilter?.frequency.setTargetAtTime(boosting ? 1500 + speedNorm * 900 : 800, now, 0.06);
  }

  private playShiftPop(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.07);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playNearMiss(combo: number, withHorn: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Crisp Doppler swoosh + combo ping
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = 420 + Math.min(combo, 6) * 55;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, now + 0.11);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);

    // Authentic Mumbai dual-tone Kaali-Peeli / traffic horn occasionally
    if (withHorn) {
      const h1 = this.ctx.createOscillator();
      const h2 = this.ctx.createOscillator();
      const hg = this.ctx.createGain();
      h1.type = 'sawtooth';
      h2.type = 'sawtooth';
      h1.frequency.setValueAtTime(415, now + 0.02);
      h2.frequency.setValueAtTime(520, now + 0.02);
      const hf = this.ctx.createBiquadFilter();
      hf.type = 'bandpass';
      hf.frequency.value = 900;
      hg.gain.setValueAtTime(0.001, now + 0.02);
      hg.gain.linearRampToValueAtTime(0.065, now + 0.05);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      h1.connect(hf);
      h2.connect(hf);
      hf.connect(hg);
      hg.connect(this.masterGain);
      h1.start(now + 0.02);
      h2.start(now + 0.02);
      h1.stop(now + 0.3);
      h2.stop(now + 0.3);
    }
  }

  public playCollision(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCountdownBeep(isGo: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.36 : 0.16));
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.38 : 0.18));
  }

  public playFinishFanfare(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
