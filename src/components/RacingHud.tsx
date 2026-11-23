import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { generateMinimapPoints, TRACK_LENGTH } from '../game/track';
import type { CameraMode, HudTelemetry, TimeOfDay } from '../game/types';

export type TouchControlKey = 'left' | 'right' | 'power' | 'brake' | 'nitro';

interface RacingHudProps {
  telemetry: HudTelemetry;
  timeOfDay: TimeOfDay;
  cameraMode: CameraMode;
  muted: boolean;
  isFullscreen: boolean;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onToggleTimeOfDay: () => void;
  onToggleFullscreen: () => void;
  onPause: () => void;
  onTouchControl: (control: TouchControlKey, active: boolean) => void;
}

function formatRaceTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem.toFixed(2)}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export function RacingHud({
  telemetry,
  timeOfDay,
  cameraMode,
  muted,
  isFullscreen,
  onToggleCamera,
  onToggleMute,
  onToggleTimeOfDay,
  onToggleFullscreen,
  onPause,
  onTouchControl,
}: RacingHudProps) {
  const [pressed, setPressed] = useState<Record<TouchControlKey, boolean>>({
    left: false,
    right: false,
    power: false,
    brake: false,
    nitro: false,
  });

  const mapPoints = useMemo(() => generateMinimapPoints(44), []);
  const polylineStr = useMemo(
    () => mapPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    [mapPoints]
  );

  const sampleMinimap = (progress: number) => {
    const idx = Math.min(
      mapPoints.length - 1,
      Math.max(0, Math.round(progress * (mapPoints.length - 1)))
    );
    return mapPoints[idx];
  };

  const playerDot = sampleMinimap(telemetry.progress);

  // Multi-touch safe pointer capture binding for Left, Right, Power, Brake, Nitro
  const bindControl = (control: TouchControlKey) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      setPressed((prev) => (prev[control] ? prev : { ...prev, [control]: true }));
      onTouchControl(control, true);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      setPressed((prev) => (prev[control] ? { ...prev, [control]: false } : prev));
      onTouchControl(control, false);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setPressed((prev) => (prev[control] ? { ...prev, [control]: false } : prev));
      onTouchControl(control, false);
    },
    onLostPointerCapture: () => {
      setPressed((prev) => (prev[control] ? { ...prev, [control]: false } : prev));
      onTouchControl(control, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const rpmPct = Math.round(Math.min(1, Math.max(0.05, telemetry.rpmRatio)) * 100);
  const rpmBarColor = telemetry.isBoosting
    ? 'bg-sky-400'
    : telemetry.rpmRatio > 0.85
      ? 'bg-red-500'
      : 'bg-amber-400';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none">
      {/* Subtle Impact Vignette Flash */}
      {telemetry.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 110px rgba(239, 68, 68, ${(telemetry.damageFlash * 0.65).toFixed(2)})`,
          }}
        />
      )}

      {/* Horizontal Top Telemetry Row — Slim for Widescreen Playfield */}
      <div className="flex items-start justify-between px-3 sm:px-5 pt-2.5 sm:pt-3.5 gap-2.5">
        {/* Top-Left: Position, Route Progress & Compact Minimap */}
        <div className="flex flex-col gap-2">
          <div className="bg-[#080f1e]/86 border border-white/14 rounded-md px-3 py-2 min-w-[180px] sm:min-w-[235px]">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-extrabold text-xl sm:text-2xl text-amber-400 tabular-nums leading-none">
                  {ordinal(telemetry.position)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono-num">
                  /{telemetry.totalRacers}
                </span>
              </div>
              <div className="font-mono-num text-[11px] sm:text-xs text-slate-200 whitespace-nowrap">
                {(telemetry.distanceM / 1000).toFixed(2)} / {(TRACK_LENGTH / 1000).toFixed(1)} km
              </div>
            </div>

            <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(telemetry.progress * 100)}%` }}
              />
            </div>

            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-300 truncate max-w-[180px] sm:max-w-[220px]">
              {telemetry.landmarkName}
            </div>
          </div>

          {/* Compact Curved Back Bay Minimap (visible on taller horizontal screens) */}
          <div className="hidden md:flex flex-col bg-[#080f1e]/80 border border-white/12 rounded-md p-2 w-[112px]">
            <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
              <span>Nariman</span>
              <span>Chowpatty</span>
            </div>
            <svg viewBox="0 0 100 100" className="w-full h-[76px]">
              <polyline
                points={polylineStr}
                fill="none"
                stroke="rgba(148,163,184,0.3)"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <polyline
                points={polylineStr}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.7"
              />
              {telemetry.rivals.map((r) => {
                const pt = sampleMinimap(r.progress);
                return (
                  <circle
                    key={r.id}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.2"
                    fill={r.color}
                    stroke="#080f1e"
                    strokeWidth="1"
                  />
                );
              })}
              <circle
                cx={playerDot.x}
                cy={playerDot.y}
                r="4.5"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>

        {/* Top-Center: Horizontal Digital Speedometer, Gear, RPM & Nitro Strip */}
        <div className="bg-[#080f1e]/88 border border-white/14 rounded-md px-3.5 sm:px-5 py-2 flex items-center gap-3 sm:gap-5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-extrabold text-2xl sm:text-3xl text-white tabular-nums leading-none">
              {telemetry.speedKmh}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider">KM/H</span>
          </div>

          <div className="h-7 w-px bg-white/12" />

          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-slate-400 font-semibold">G</span>
            <span className="font-display font-extrabold text-xl sm:text-2xl text-amber-400 tabular-nums leading-none">
              {telemetry.gear}
            </span>
          </div>

          <div className="hidden sm:flex flex-col gap-1.5 w-[112px]">
            <div className="flex items-center justify-between text-[10px] leading-none">
              <span className="text-slate-400 font-semibold">RPM</span>
              <span className={telemetry.isBoosting ? 'text-sky-400 font-semibold' : 'text-amber-300 font-mono-num'}>
                Nitro {telemetry.nitro}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
              <div className={`h-full ${rpmBarColor}`} style={{ width: `${rpmPct}%` }} />
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-xs overflow-hidden">
              <div
                className={telemetry.isBoosting ? 'h-full bg-sky-400' : 'h-full bg-amber-400'}
                style={{ width: `${telemetry.nitro}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Right: Timer, Score & Functional Action Buttons */}
        <div className="flex items-start gap-2">
          <div className="hidden sm:block bg-[#080f1e]/86 border border-white/12 rounded-md px-3 py-1.5 text-right">
            <div className="font-mono-num text-sm sm:text-base font-bold text-white leading-tight">
              {formatRaceTime(telemetry.elapsedSec)}
            </div>
            <div className="text-[10px] text-slate-300 font-mono-num">
              {telemetry.score.toLocaleString('en-IN')} pts · {telemetry.nearMissCount} passes
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
              aria-label="Toggle fullscreen horizontal display"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-[#080f1e]/88 border border-white/14 text-slate-200 hover:text-amber-300 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleTimeOfDay}
              title="Toggle Day / Night"
              aria-label="Toggle Day or Night mode"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-[#080f1e]/88 border border-white/14 text-slate-200 hover:text-amber-300 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              {timeOfDay === 'night' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              title={`Camera: ${cameraMode === 'chase' ? 'Chase' : 'Helmet'} (C)`}
              aria-label="Switch camera view"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-[#080f1e]/88 border border-white/14 text-slate-200 hover:text-amber-300 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute' : 'Mute'}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-9 h-9 flex items-center justify-center rounded-md bg-[#080f1e]/88 border border-white/14 text-slate-200 hover:text-amber-300 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              title="Pause (Esc)"
              aria-label="Pause race"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-[#080f1e]/88 border border-white/14 text-slate-200 hover:text-amber-300 hover:border-amber-400/50 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center Countdown / Near-Miss Callout */}
      <div className="flex flex-col items-center justify-center pointer-events-none">
        {telemetry.countdownValue > 0 && (
          <div className="font-display font-extrabold text-6xl sm:text-8xl text-amber-400 drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)] tabular-nums">
            {telemetry.countdownValue}
          </div>
        )}
        {telemetry.nearMissBanner && telemetry.countdownValue === 0 && (
          <div className="px-4 py-1.5 rounded-md bg-[#080f1e]/92 border border-amber-400/55 font-display font-bold text-xs sm:text-sm text-amber-300 tracking-wide">
            {telemetry.nearMissBanner}
          </div>
        )}
      </div>

      {/* Horizontal Bottom Control Deck:
          LEFT TURN (far left) · POWER BOOST (dead center) · RIGHT TURN (far right) */}
      <div className="relative flex items-end justify-between px-4 sm:px-7 pb-3.5 sm:pb-5 gap-3">
        {/* Far Left: Left Turn Steering Button */}
        <button
          type="button"
          aria-label="Turn Left"
          {...bindControl('left')}
          className={`pointer-events-auto touch-none select-none flex flex-col items-center justify-center w-[78px] h-[66px] sm:w-[96px] sm:h-[74px] rounded-xl border-2 transition-transform cursor-pointer ${
            pressed.left
              ? 'bg-amber-500 border-amber-300 text-slate-950 scale-95'
              : 'bg-[#080f1e]/86 border-white/22 text-white hover:border-amber-400/70'
          }`}
        >
          <ChevronLeft className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.75]" />
          <span className="font-display font-bold text-[10px] tracking-wider leading-none -mt-0.5">
            LEFT
          </span>
        </button>

        {/* Dead Center: POWER Speed Boost Button (with integrated boost charge gauge) + subtle Brake */}
        <div className="pointer-events-auto flex items-end gap-2.5">
          <button
            type="button"
            aria-label="Power Speed Boost"
            {...bindControl('power')}
            className={`touch-none select-none relative overflow-hidden flex flex-col items-center justify-center w-[132px] h-[66px] sm:w-[160px] sm:h-[74px] rounded-xl border-2 transition-transform cursor-pointer ${
              pressed.power || telemetry.isBoosting
                ? 'bg-sky-400 border-white text-slate-950 scale-95'
                : telemetry.nitro > 12
                  ? 'bg-amber-500 border-amber-300 text-slate-950 hover:bg-amber-400'
                  : 'bg-[#080f1e]/86 border-white/15 text-slate-400'
            }`}
          >
            {/* Integrated boost charge progress strip at bottom of Power button */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
              <div
                className={
                  pressed.power || telemetry.isBoosting ? 'h-full bg-white' : 'h-full bg-slate-950/55'
                }
                style={{ width: `${telemetry.nitro}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Zap
                className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  pressed.power || telemetry.isBoosting || telemetry.nitro > 12
                    ? 'fill-slate-950'
                    : ''
                }`}
              />
              <span className="font-display font-extrabold text-sm sm:text-base tracking-wider leading-none">
                POWER
              </span>
            </div>
            <span className="font-mono-num text-[10px] font-bold opacity-85 mt-1">
              {telemetry.isBoosting ? 'BOOSTING' : `BOOST ${telemetry.nitro}%`}
            </span>
          </button>

          <button
            type="button"
            aria-label="Brake"
            {...bindControl('brake')}
            className={`touch-none select-none flex flex-col items-center justify-center w-[52px] h-[48px] sm:w-[60px] sm:h-[52px] rounded-lg border transition-transform cursor-pointer ${
              pressed.brake
                ? 'bg-red-500 border-red-300 text-white scale-95'
                : 'bg-[#080f1e]/82 border-white/16 text-slate-300 hover:border-red-400/70'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span className="font-display font-bold text-[9px] tracking-wide mt-0.5">BRAKE</span>
          </button>
        </div>

        {/* Far Right: Right Turn Steering Button */}
        <button
          type="button"
          aria-label="Turn Right"
          {...bindControl('right')}
          className={`pointer-events-auto touch-none select-none flex flex-col items-center justify-center w-[78px] h-[66px] sm:w-[96px] sm:h-[74px] rounded-xl border-2 transition-transform cursor-pointer ${
            pressed.right
              ? 'bg-amber-500 border-amber-300 text-slate-950 scale-95'
              : 'bg-[#080f1e]/86 border-white/22 text-white hover:border-amber-400/70'
          }`}
        >
          <ChevronRight className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.75]" />
          <span className="font-display font-bold text-[10px] tracking-wider leading-none -mt-0.5">
            RIGHT
          </span>
        </button>
      </div>
    </div>
  );
}
