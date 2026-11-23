import { Maximize2, Minimize2, Moon, Play, Sun, Volume2, VolumeX, Wrench } from 'lucide-react';
import type { PlayerProfile, TimeOfDay, TrafficDensity } from '../game/types';
import { BIKE_CLASSES } from '../game/types';
import { PWAInstallAndShareControl } from './InstallAppModal';

interface TitleOverlayProps {
  profile: PlayerProfile;
  muted: boolean;
  isFullscreen: boolean;
  onStartRace: () => void;
  onOpenGarage: () => void;
  onTimeOfDayChange: (mode: TimeOfDay) => void;
  onTrafficChange: (density: TrafficDensity) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}

function formatTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem.toFixed(2)}`;
}

export function TitleOverlay({
  profile,
  muted,
  isFullscreen,
  onStartRace,
  onOpenGarage,
  onTimeOfDayChange,
  onTrafficChange,
  onToggleMute,
  onToggleFullscreen,
}: TitleOverlayProps) {
  const activeClass =
    BIKE_CLASSES.find((c) => c.id === profile.visuals.bikeClass) ?? BIKE_CLASSES[1];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      {/* Measured left-to-right scrim preserving 3D coastal vista on center & right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(96deg, rgba(6,11,22,0.88) 0%, rgba(6,11,22,0.62) 36%, rgba(6,11,22,0.12) 64%, rgba(6,11,22,0.0) 100%)',
        }}
      />

      {/* Top Perimeter Bar */}
      <div className="relative z-10 flex items-center justify-between px-5 sm:px-9 pt-3.5 sm:pt-5 gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-300 tracking-wide">
          <span className="font-semibold text-amber-400">Nariman Point → Girgaon Chowpatty</span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span className="tabular-nums">3.6 km Coastal Sprint</span>
          {profile.bestTimeSec !== null && (
            <>
              <span aria-hidden="true" className="text-slate-500 hidden sm:inline">·</span>
              <span className="font-mono-num text-slate-200 hidden sm:inline">
                Best {formatTime(profile.bestTimeSec)}
              </span>
            </>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="text-xs sm:text-sm font-mono-num text-amber-400 font-semibold whitespace-nowrap mr-1">
            ₹ {profile.credits.toLocaleString('en-IN')}
          </div>
          <PWAInstallAndShareControl />
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Horizontal Fullscreen'}
            aria-label="Toggle fullscreen horizontal display"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-[#0b1222]/85 border border-white/15 text-slate-200 hover:border-amber-400/60 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-[#0b1222]/85 border border-white/15 text-slate-200 hover:border-amber-400/60 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Hero Lockup & Controls on Left Negative Space (compact on short landscape heights) */}
      <div className="relative z-10 px-5 sm:px-9 my-auto max-w-lg pointer-events-auto">
        <div className="mb-3 sm:mb-5">
          <svg
            viewBox="0 0 420 118"
            className="w-full max-w-[280px] sm:max-w-[380px] h-auto"
            role="img"
            aria-label="Marine Drive GP"
          >
            <path
              d="M 10 26 Q 115 4 245 18 T 406 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            />
            {[28, 72, 118, 166, 214, 262, 310, 358, 396].map((cx, i) => (
              <circle
                key={cx}
                cx={cx}
                cy={21 - Math.sin((i / 8) * Math.PI) * 9}
                r="2.6"
                fill="#fde68a"
              />
            ))}
            <text
              x="6"
              y="74"
              fill="#f8fafc"
              fontFamily="Oxanium, sans-serif"
              fontWeight="800"
              fontSize="48"
              letterSpacing="1.5"
            >
              MARINE DRIVE
            </text>
            <text
              x="8"
              y="108"
              fill="#f59e0b"
              fontFamily="Oxanium, sans-serif"
              fontWeight="700"
              fontSize="26"
              letterSpacing="6"
            >
              MUMBAI COASTAL GP
            </text>
          </svg>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md hidden min-[480px]:block">
            Carve through Kaali-Peeli taxis and BEST double-deckers along Back Bay’s Art Deco
            boulevard, from Air India Tower to Girgaon Chowpatty.
          </p>
        </div>

        {/* Mode Selectors: Time of Day + Traffic Density */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
          <div className="flex items-center p-1 rounded-md bg-[#0b1222]/90 border border-white/12">
            <button
              type="button"
              onClick={() => onTimeOfDayChange('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                profile.timeOfDay === 'day'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Day Coast
            </button>
            <button
              type="button"
              onClick={() => onTimeOfDayChange('night')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                profile.timeOfDay === 'night'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Night
            </button>
          </div>

          <div className="flex items-center p-1 rounded-md bg-[#0b1222]/90 border border-white/12">
            {(['light', 'medium', 'rush'] as TrafficDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onTrafficChange(d)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                  profile.trafficDensity === d
                    ? 'bg-slate-200 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {d === 'light' ? 'Light' : d === 'medium' ? 'Coastal' : 'Rush'}
              </button>
            ))}
          </div>
        </div>

        {/* Primary & Secondary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onStartRace}
            className="flex items-center gap-2 px-6 py-2.5 sm:py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm sm:text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Start Race
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-md bg-[#0e1729]/90 hover:bg-[#16223a] border border-white/15 text-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            Garage & Upgrades
          </button>
        </div>

        {/* Active Machine Quiet Metadata */}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-200 font-medium">{activeClass.name}</span>
          <span aria-hidden="true">·</span>
          <span>{activeClass.displacement}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">ECU Lvl {profile.upgrades.engine}</span>
        </div>
      </div>

      {/* Single Flat Control-Hint Footer Line */}
      <div className="relative z-10 px-5 sm:px-9 pb-3 sm:pb-4 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
        <span>
          Auto-Cruise · Left / Right Steer · Center Power Boost (Space / Shift) · C Camera · Esc Pause
        </span>
      </div>
    </div>
  );
}
