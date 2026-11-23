import { Moon, Play, RotateCcw, Sun, Trophy, Wrench } from 'lucide-react';
import type { RaceResult, TimeOfDay } from '../game/types';

interface PauseModalProps {
  timeOfDay: TimeOfDay;
  onResume: () => void;
  onRestart: () => void;
  onToggleTimeOfDay: () => void;
  onOpenGarage: () => void;
  onMainTitle: () => void;
}

export function PauseModal({
  timeOfDay,
  onResume,
  onRestart,
  onToggleTimeOfDay,
  onOpenGarage,
  onMainTitle,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b16]/76 px-4">
      <div className="w-full max-w-sm bg-[#0b1324] border border-white/15 rounded-lg p-6">
        <div className="font-display font-bold text-2xl text-white tracking-wide">
          Race Paused
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Marine Drive · Nariman Point to Girgaon Chowpatty
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Resume Race
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-white/6 hover:bg-white/10 border border-white/12 text-slate-100 text-sm font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Restart from Nariman Point
          </button>

          <button
            type="button"
            onClick={onToggleTimeOfDay}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-white/6 hover:bg-white/10 border border-white/12 text-slate-100 text-sm font-semibold transition-colors cursor-pointer"
          >
            {timeOfDay === 'night' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                Switch to Day Coast
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-amber-400" />
                Switch to Queen’s Necklace Night
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-white/6 hover:bg-white/10 border border-white/12 text-slate-100 text-sm font-semibold transition-colors cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            Garage & Upgrades
          </button>

          <button
            type="button"
            onClick={onMainTitle}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer mt-1"
          >
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}

interface FinishModalProps {
  result: RaceResult;
  totalCredits: number;
  onRaceAgain: () => void;
  onOpenGarage: () => void;
  onMainTitle: () => void;
}

function formatFinishTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem.toFixed(2)}`;
}

function positionLabel(pos: number): string {
  if (pos === 1) return '1st Place · Girgaon Chowpatty Winner';
  if (pos === 2) return '2nd Place · Podium Finish';
  if (pos === 3) return '3rd Place · Podium Finish';
  return `${pos}th Place · Run Complete`;
}

export function FinishModal({
  result,
  totalCredits,
  onRaceAgain,
  onOpenGarage,
  onMainTitle,
}: FinishModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060b16]/72 px-4">
      <div className="w-full max-w-md bg-[#0b1324] border border-white/15 rounded-lg p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-amber-400">
              Girgaon Chowpatty Checkered Flag
            </div>
            <h2 className="font-display font-extrabold text-2xl text-white mt-0.5">
              {positionLabel(result.position)}
            </h2>
          </div>
          <div className="w-11 h-11 rounded-md bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Race Telemetry Summary Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4">
          <div>
            <div className="text-xs text-slate-400">Finish Time</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">
              {formatFinishTime(result.finishTimeSec)}
            </div>
            {result.isNewBest && (
              <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                New Personal Best
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-slate-400">Credits Earned</div>
            <div className="font-mono-num text-xl font-bold text-amber-400 mt-0.5">
              + ₹{result.creditsEarned.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
              Balance ₹{totalCredits.toLocaleString('en-IN')}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Top Speed</div>
            <div className="font-mono-num text-base font-bold text-slate-100 mt-0.5">
              {result.topSpeedKmh} km/h
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Close Passes · Score</div>
            <div className="font-mono-num text-base font-bold text-slate-100 mt-0.5">
              {result.nearMissCount} · {result.score.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRaceAgain}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Race Marine Drive Again
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-white/8 hover:bg-white/12 border border-white/14 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            Upgrade Bike in Garage
          </button>

          <button
            type="button"
            onClick={onMainTitle}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Back to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
