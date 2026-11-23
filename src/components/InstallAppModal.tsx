import { useState } from 'react';
import { Check, Copy, Download, Share2, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallAndShareControl() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Marine Drive GP — Mumbai Bike Racing',
          text: 'Race customized sportbikes from Nariman Point to Girgaon Chowpatty!',
          url: shareUrl,
        });
        return;
      } catch {
        // User canceled native share
      }
    }
    void handleCopyUrl();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={() => void install()}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Install App
          </button>
        )}

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title="Android APK & Share with Friends"
          className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#0b1222]/85 border border-white/15 text-slate-200 hover:border-amber-400/60 hover:text-amber-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Android / Share</span>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a14]/82 px-4 pointer-events-auto">
          <div className="w-full max-w-md bg-[#0b1324] border border-white/15 rounded-lg p-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-xl text-white">
                  Install & Package Android APK
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  PWA Manifest, landscape fullscreen lock & offline caching are active.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close install guide"
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instant Actions: Direct Install + Share Link */}
            <div className="mt-4 flex flex-wrap gap-2">
              {!isInstalled && isInstallable && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Install on This Device
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md bg-white/8 hover:bg-white/12 border border-white/14 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                Share Link
              </button>
              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md bg-white/8 hover:bg-white/12 border border-white/14 text-slate-200 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy URL'}
              </button>
            </div>

            {/* Two Clear Paths for Android Friends */}
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-xs text-slate-300 leading-relaxed">
              <div>
                <div className="font-semibold text-white mb-1">
                  Option 1: Create a Real .APK File (Free via PWABuilder)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Deploy / share this app and copy the public HTTPS URL.</li>
                  <li>
                    Open <span className="text-amber-300 font-medium">pwabuilder.com</span> and paste
                    the URL.
                  </li>
                  <li>
                    Click <span className="text-white font-medium">Package for Stores → Android → Generate Package</span> to download a ready-to-share <span className="font-mono-num text-amber-300">.apk</span> file.
                  </li>
                </ol>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="font-semibold text-white mb-1">
                  Option 2: Instant Fullscreen App (No APK Needed)
                </div>
                {isIOS ? (
                  <p>
                    In Safari, tap <strong className="text-white">Share</strong> then{' '}
                    <strong className="text-white">Add to Home Screen</strong> to launch Marine
                    Drive GP fullscreen.
                  </p>
                ) : (
                  <p>
                    Send the game link to friends on Android Chrome — tapping{' '}
                    <strong className="text-white">Install App</strong> adds a fullscreen landscape
                    launcher icon that plays offline like a native APK.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md bg-[#0b1324] border border-amber-400/50 px-3.5 py-1.5 text-xs font-medium text-amber-300">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Playing from cached files</span>
    </div>
  );
}
