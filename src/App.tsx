import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { GarageDock } from './components/GarageDock';
import { OfflineBanner } from './components/InstallAppModal';
import { FinishModal, PauseModal } from './components/RaceModal';
import { RacingHud, type TouchControlKey } from './components/RacingHud';
import { TitleOverlay } from './components/TitleOverlay';
import { MarineDriveEngine } from './game/engine';
import {
  getUpgradeCost,
  loadProfile,
  saveProfile,
  type CameraMode,
  type GameScreen,
  type HudTelemetry,
  type PlayerProfile,
  type RaceResult,
  type TimeOfDay,
  type TrafficDensity,
  type UpgradeLevels,
} from './game/types';

const INITIAL_TELEMETRY: HudTelemetry = {
  speedKmh: 0,
  rpmRatio: 0.16,
  gear: 1,
  nitro: 100,
  isBoosting: false,
  progress: 0,
  distanceM: 0,
  elapsedSec: 0,
  position: 4,
  totalRacers: 4,
  score: 0,
  nearMissCount: 0,
  nearMissCombo: 0,
  nearMissBanner: null,
  landmarkName: 'Nariman Point · Air India & Oberoi',
  countdownValue: 3,
  topSpeedKmh: 0,
  rivals: [],
  wrongWay: false,
  damageFlash: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MarineDriveEngine | null>(null);

  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [screen, setScreen] = useState<GameScreen>('title');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissPortraitHint, setDismissPortraitHint] = useState(false);

  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Persist profile edits
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  // Track horizontal/portrait orientation and fullscreen state
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsPortraitMobile(portrait);
      if (!portrait) setDismissPortraitHint(false);
    };
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Mount isolated 60fps Three.js engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const initial = profileRef.current;
    const engine = new MarineDriveEngine(
      mount,
      {
        upgrades: initial.upgrades,
        handling: initial.handling,
        visuals: initial.visuals,
        timeOfDay: initial.timeOfDay,
        trafficDensity: initial.trafficDensity,
        bestTimeSec: initial.bestTimeSec,
      },
      {
        onTelemetry: (snap) => setTelemetry(snap),
        onScreenChange: (nextScreen) => setScreen(nextScreen),
        onRaceFinish: (res) => {
          setRaceResult(res);
          setProfile((prev) => ({
            ...prev,
            credits: prev.credits + res.creditsEarned,
            racesCompleted: prev.racesCompleted + 1,
            bestTimeSec:
              prev.bestTimeSec === null || res.finishTimeSec < prev.bestTimeSec
                ? res.finishTimeSec
                : prev.bestTimeSec,
          }));
        },
        onContextLost: (lost) => setContextLost(lost),
      }
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keyboard shortcuts on Title screen (Enter / Space starts race immediately)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        engineRef.current?.startRace();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [screen]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        const orientation = window.screen?.orientation;
        if (orientation && 'lock' in orientation) {
          await (orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock(
            'landscape'
          );
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Orientation lock or fullscreen may be restricted inside embedded iframes
    }
  }, []);

  const handleTimeOfDayChange = useCallback((mode: TimeOfDay) => {
    setProfile((prev) => ({ ...prev, timeOfDay: mode }));
    engineRef.current?.setTimeOfDay(mode);
  }, []);

  const handleToggleTimeOfDay = useCallback(() => {
    const next: TimeOfDay = profileRef.current.timeOfDay === 'night' ? 'day' : 'night';
    handleTimeOfDayChange(next);
  }, [handleTimeOfDayChange]);

  const handleTrafficChange = useCallback((density: TrafficDensity) => {
    setProfile((prev) => ({ ...prev, trafficDensity: density }));
    engineRef.current?.setTrafficDensity(density);
  }, []);

  const handlePurchaseUpgrade = useCallback((key: keyof UpgradeLevels) => {
    setProfile((prev) => {
      const lvl = prev.upgrades[key];
      if (lvl >= 5) return prev;
      const cost = getUpgradeCost(key, lvl);
      if (prev.credits < cost) return prev;
      const nextUpgrades = { ...prev.upgrades, [key]: lvl + 1 };
      engineRef.current?.setBikeConfig(nextUpgrades, prev.handling, prev.visuals);
      return {
        ...prev,
        credits: prev.credits - cost,
        upgrades: nextUpgrades,
      };
    });
  }, []);

  const handleUpdateHandling = useCallback((patch: Partial<PlayerProfile['handling']>) => {
    setProfile((prev) => {
      const nextHandling = { ...prev.handling, ...patch };
      engineRef.current?.setBikeConfig(prev.upgrades, nextHandling, prev.visuals);
      return { ...prev, handling: nextHandling };
    });
  }, []);

  const handleUpdateVisuals = useCallback((patch: Partial<PlayerProfile['visuals']>) => {
    setProfile((prev) => {
      const nextVisuals = { ...prev.visuals, ...patch };
      engineRef.current?.setBikeConfig(prev.upgrades, prev.handling, nextVisuals);
      return { ...prev, visuals: nextVisuals };
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.unlockAudio();
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleCamera = useCallback(() => {
    const next = engineRef.current?.toggleCameraMode();
    if (next) setCameraMode(next);
  }, []);

  const handleStartRace = useCallback(() => {
    setRaceResult(null);
    engineRef.current?.startRace();
  }, []);

  const handleOpenGarage = useCallback(() => {
    setRaceResult(null);
    engineRef.current?.enterGarage();
  }, []);

  const handleMainTitle = useCallback(() => {
    setRaceResult(null);
    engineRef.current?.enterTitle();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseRace();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeRace();
  }, []);

  const handleTouchControl = useCallback((control: TouchControlKey, active: boolean) => {
    engineRef.current?.unlockAudio();
    engineRef.current?.setTouchControl(control, active);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070d1a]">
      {/* Isolated WebGL Viewport Container (React state updates never re-mount canvas) */}
      <div
        ref={canvasMountRef}
        className={`w-full h-full ${screen === 'garage' ? 'cursor-grab active:cursor-grabbing' : ''}`}
      />

      {/* Non-blocking Landscape Recommendation Banner on Narrow Portrait Devices */}
      {isPortraitMobile && !dismissPortraitHint && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-sm bg-[#091224]/95 border border-amber-400/45 rounded-md px-3.5 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-100">
            <RotateCw className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Rotate horizontally for full widescreen Marine Drive racing</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissPortraitHint(true)}
            aria-label="Dismiss rotate hint"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* WebGL Context Lost Graceful Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070d1a]/95 px-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-display font-bold text-xl text-white">
              Graphics Context Suspended
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Your browser paused WebGL rendering. Reload the page to restore the 3D Marine Drive
              coastline.
            </p>
          </div>
        </div>
      )}

      {screen === 'title' && (
        <TitleOverlay
          profile={profile}
          muted={muted}
          isFullscreen={isFullscreen}
          onStartRace={handleStartRace}
          onOpenGarage={handleOpenGarage}
          onTimeOfDayChange={handleTimeOfDayChange}
          onTrafficChange={handleTrafficChange}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {screen === 'garage' && (
        <GarageDock
          profile={profile}
          onBack={handleMainTitle}
          onStartRace={handleStartRace}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onUpdateHandling={handleUpdateHandling}
          onUpdateVisuals={handleUpdateVisuals}
          onTimeOfDayChange={handleTimeOfDayChange}
          onTrafficChange={handleTrafficChange}
        />
      )}

      {(screen === 'countdown' || screen === 'racing') && (
        <RacingHud
          telemetry={telemetry}
          timeOfDay={profile.timeOfDay}
          cameraMode={cameraMode}
          muted={muted}
          isFullscreen={isFullscreen}
          onToggleCamera={handleToggleCamera}
          onToggleMute={handleToggleMute}
          onToggleTimeOfDay={handleToggleTimeOfDay}
          onToggleFullscreen={handleToggleFullscreen}
          onPause={handlePause}
          onTouchControl={handleTouchControl}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          timeOfDay={profile.timeOfDay}
          onResume={handleResume}
          onRestart={handleStartRace}
          onToggleTimeOfDay={handleToggleTimeOfDay}
          onOpenGarage={handleOpenGarage}
          onMainTitle={handleMainTitle}
        />
      )}

      {screen === 'finished' && raceResult && (
        <FinishModal
          result={raceResult}
          totalCredits={profile.credits}
          onRaceAgain={handleStartRace}
          onOpenGarage={handleOpenGarage}
          onMainTitle={handleMainTitle}
        />
      )}

      <OfflineBanner />
    </div>
  );
}
