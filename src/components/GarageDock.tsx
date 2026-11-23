import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Moon, Play, Sun } from 'lucide-react';
import {
  BIKE_CLASSES,
  computeBikeStats,
  EXHAUST_OPTIONS,
  getUpgradeCost,
  PAINT_SWATCHES,
  RIM_SWATCHES,
  UNDERGLOW_OPTIONS,
  UPGRADE_SPECS,
  type BikeClassId,
  type BrakeStyle,
  type ExhaustStyle,
  type LeanStyle,
  type PaintFinish,
  type PlayerProfile,
  type TimeOfDay,
  type TrafficDensity,
  type UnderglowColor,
  type UpgradeLevels,
} from '../game/types';

type GarageTab = 'upgrades' | 'handling' | 'visuals' | 'environment';

interface GarageDockProps {
  profile: PlayerProfile;
  onBack: () => void;
  onStartRace: () => void;
  onPurchaseUpgrade: (key: keyof UpgradeLevels) => void;
  onUpdateHandling: (patch: Partial<PlayerProfile['handling']>) => void;
  onUpdateVisuals: (patch: Partial<PlayerProfile['visuals']>) => void;
  onTimeOfDayChange: (mode: TimeOfDay) => void;
  onTrafficChange: (density: TrafficDensity) => void;
}

export function GarageDock({
  profile,
  onBack,
  onStartRace,
  onPurchaseUpgrade,
  onUpdateHandling,
  onUpdateVisuals,
  onTimeOfDayChange,
  onTrafficChange,
}: GarageDockProps) {
  const [activeTab, setActiveTab] = useState<GarageTab>('upgrades');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stats = computeBikeStats(
    profile.upgrades,
    profile.handling,
    profile.visuals.bikeClass
  );
  const activeClass =
    BIKE_CLASSES.find((c) => c.id === profile.visuals.bikeClass) ?? BIKE_CLASSES[1];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      {/* Top Perimeter Spec Bar (zero center viewport occlusion) */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 sm:px-8 pt-5">
        <div className="pointer-events-auto bg-[#091020]/90 border border-white/12 rounded-lg px-4 py-3 min-w-[270px]">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="font-display font-bold text-base text-white tracking-wide">
                {activeClass.name}
              </div>
              <div className="text-xs text-slate-400">
                {activeClass.displacement} · Top {stats.topSpeedKmh} km/h
              </div>
            </div>
            <div className="font-mono-num text-sm font-bold text-amber-400 whitespace-nowrap">
              ₹ {profile.credits.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Live Compact Telemetry Stat Bars */}
          <div className="grid grid-cols-4 gap-2.5 mt-3">
            {[
              { label: 'Speed', val: stats.speedRating },
              { label: 'Accel', val: stats.accelRating },
              { label: 'Grip', val: stats.handlingRating },
              { label: 'Nitro', val: stats.nitroRating },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>{s.label}</span>
                  <span className="font-mono-num text-slate-200">{s.val}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-200"
                    style={{ width: `${s.val}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#091020]/90 border border-white/14 text-slate-200 hover:text-white hover:border-white/30 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Title
          </button>
          <button
            type="button"
            onClick={onStartRace}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            Race Now
          </button>
        </div>
      </div>

      {/* Unified Collapsible Bottom Customization Dock */}
      <div className="flex flex-col items-center px-3 pb-4">
        <div className="pointer-events-auto flex items-center gap-3 mb-1.5">
          <span className="text-[11px] text-slate-300/80 hidden sm:inline">
            Drag viewport to inspect 360°
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#091020]/90 border border-white/14 text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {collapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show Garage
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Hide Garage
              </>
            )}
          </button>
        </div>

        <div
          className={`pointer-events-auto w-full max-w-[940px] bg-[#091020]/94 border border-white/14 rounded-lg transition-transform duration-200 ${
            collapsed ? 'translate-y-[120%] pointer-events-none' : 'translate-y-0'
          }`}
        >
          {/* Dock Tabs */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 pt-2 pb-1.5 gap-3 overflow-x-auto">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'upgrades', label: 'Performance Upgrades' },
                  { id: 'handling', label: 'Handling Setup' },
                  { id: 'visuals', label: 'Visual Aesthetics' },
                  { id: 'environment', label: 'Coastal Conditions' },
                ] as { id: GarageTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
              <span>{profile.timeOfDay === 'night' ? 'Night Mode' : 'Day Mode'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {profile.trafficDensity === 'rush'
                  ? 'Rush Hour'
                  : profile.trafficDensity === 'light'
                    ? 'Light Traffic'
                    : 'Coastal Traffic'}
              </span>
            </div>
          </div>

          {/* Dock Tab Body (fits cleanly in landscape screens) */}
          <div className="p-3 sm:p-4 max-h-[38vh] overflow-y-auto">
            {activeTab === 'upgrades' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {UPGRADE_SPECS.map((spec) => {
                  const lvl = profile.upgrades[spec.key];
                  const isMax = lvl >= 5;
                  const cost = getUpgradeCost(spec.key, lvl);
                  const canAfford = !isMax && profile.credits >= cost;

                  return (
                    <div
                      key={spec.key}
                      className="flex flex-col justify-between p-3 rounded-md bg-white/[0.03] border border-white/10"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{spec.label}</span>
                          <span className="font-mono-num text-xs text-amber-400">
                            Lvl {lvl}/5
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{spec.subtitle}</p>
                        {/* 5-segment progress bar */}
                        <div className="grid grid-cols-5 gap-1 mt-2.5">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <div
                              key={step}
                              className={`h-1.5 rounded-xs ${
                                step <= lvl ? 'bg-amber-400' : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onPurchaseUpgrade(spec.key)}
                        className={`mt-3 w-full py-1.5 px-3 rounded text-xs font-semibold font-mono-num transition-colors whitespace-nowrap ${
                          isMax
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? 'Maxed' : `Upgrade · ₹${cost.toLocaleString('en-IN')}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'handling' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Steering Sensitivity Slider */}
                <div className="p-3 rounded-md bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-white">Steering Sensitivity</span>
                    <span className="font-mono-num text-amber-400">
                      {Math.round(profile.handling.steeringSensitivity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.65}
                    max={1.35}
                    step={0.05}
                    value={profile.handling.steeringSensitivity}
                    onChange={(e) =>
                      onUpdateHandling({ steeringSensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full gp-slider"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>Stable</span>
                    <span>Sharp</span>
                  </div>
                </div>

                {/* Lean Style */}
                <div className="p-3 rounded-md bg-white/[0.03] border border-white/10">
                  <div className="text-xs font-semibold text-white mb-2">Corner Lean Profile</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['touring', 'sport', 'track'] as LeanStyle[]).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => onUpdateHandling({ leanStyle: style })}
                        className={`py-1.5 rounded text-xs font-semibold capitalize transition-colors cursor-pointer ${
                          profile.handling.leanStyle === style
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brake Response */}
                <div className="p-3 rounded-md bg-white/[0.03] border border-white/10">
                  <div className="text-xs font-semibold text-white mb-2">Brake Balance</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['smooth', 'balanced', 'aggressive'] as BrakeStyle[]).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => onUpdateHandling({ brakeStyle: style })}
                        className={`py-1.5 rounded text-xs font-semibold capitalize transition-colors cursor-pointer ${
                          profile.handling.brakeStyle === style
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'visuals' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Chassis & Paint Finish */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Sportbike Class
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {BIKE_CLASSES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onUpdateVisuals({ bikeClass: c.id as BikeClassId })}
                          className={`px-2 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                            profile.visuals.bikeClass === c.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800/80 text-slate-300 hover:text-white'
                          }`}
                        >
                          {c.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Paint Finish
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['gloss', 'matte', 'metallic'] as PaintFinish[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => onUpdateVisuals({ finish: f })}
                          className={`py-1.5 rounded text-xs font-semibold capitalize transition-colors cursor-pointer ${
                            profile.visuals.finish === f
                              ? 'bg-slate-100 text-slate-950'
                              : 'bg-slate-800/80 text-slate-300 hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Body Livery Swatches & Rim Swatches */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Fairing Livery
                    </div>
                    <div className="flex items-center gap-2">
                      {PAINT_SWATCHES.map((sw) => {
                        const active = profile.visuals.primaryColor === sw.primary;
                        return (
                          <button
                            key={sw.id}
                            type="button"
                            title={sw.name}
                            onClick={() =>
                              onUpdateVisuals({
                                primaryColor: sw.primary,
                                accentColor: sw.accent,
                              })
                            }
                            className={`w-8 h-8 rounded-md border-2 transition-transform cursor-pointer ${
                              active
                                ? 'border-amber-400 scale-110'
                                : 'border-white/20 hover:scale-105'
                            }`}
                            style={{
                              background: `linear-gradient(135deg, ${sw.primary} 65%, ${sw.accent} 65%)`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Wheel Rim Accent
                    </div>
                    <div className="flex items-center gap-2">
                      {RIM_SWATCHES.map((rm) => {
                        const active = profile.visuals.rimColor === rm.color;
                        return (
                          <button
                            key={rm.id}
                            type="button"
                            title={rm.name}
                            onClick={() => onUpdateVisuals({ rimColor: rm.color })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                              active
                                ? 'border-amber-400 scale-110'
                                : 'border-white/20 hover:scale-105'
                            }`}
                            style={{ backgroundColor: rm.color }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Exhaust & Night Underglow */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Exhaust System
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {EXHAUST_OPTIONS.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => onUpdateVisuals({ exhaust: ex.id as ExhaustStyle })}
                          className={`px-2 py-1.5 rounded text-xs font-semibold transition-colors truncate cursor-pointer ${
                            profile.visuals.exhaust === ex.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800/80 text-slate-300 hover:text-white'
                          }`}
                        >
                          {ex.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      Night Underglow
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {UNDERGLOW_OPTIONS.map((ug) => (
                        <button
                          key={ug.id}
                          type="button"
                          onClick={() => onUpdateVisuals({ underglow: ug.id as UnderglowColor })}
                          className={`py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            profile.visuals.underglow === ug.id
                              ? 'bg-slate-100 text-slate-950'
                              : 'bg-slate-800/80 text-slate-300 hover:text-white'
                          }`}
                        >
                          {ug.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'environment' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-md bg-white/[0.03] border border-white/10">
                  <div className="text-xs font-semibold text-white mb-2">
                    Marine Drive Lighting Mode
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onTimeOfDayChange('day')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        profile.timeOfDay === 'day'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      Golden Afternoon
                    </button>
                    <button
                      type="button"
                      onClick={() => onTimeOfDayChange('night')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        profile.timeOfDay === 'night'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      Queen’s Necklace Night
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-white/[0.03] border border-white/10">
                  <div className="text-xs font-semibold text-white mb-2">
                    Mumbai Coastal Traffic Density
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'medium', 'rush'] as TrafficDensity[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onTrafficChange(d)}
                        className={`py-2.5 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                          profile.trafficDensity === d
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        {d === 'light' ? 'Light' : d === 'medium' ? 'Coastal' : 'Rush Hour'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
