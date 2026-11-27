"use client";

import { useState } from "react";

import SpotifyAuth from "@/components/auth/SpotifyAuth";

import QRScanner from "@/components/scanner/QRScanner";

import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";

import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

/**
 * Anzeige-Texte und Farben für den Player-Status.
 */
const PLAYER_STATUS = {
  idle: { label: "Nicht gestartet", color: "#6e7180" },
  loading: { label: "Wird gestartet …", color: "#f7c843" },
  ready: { label: "Bereit", color: "#4fae3a" },
  not_ready: { label: "Offline", color: "#e08a35" },
  error: { label: "Fehler", color: "#c43c35" },
} as const;

export default function Home() {
  /**
   * Einzige Instanz des Auth-Hooks.
   * Wird an SpotifyAuth weitergegeben, damit alle
   * Bereiche denselben Anmeldestatus verwenden.
   */
  const auth = useSpotifyAuth();

  const {
    status: playerStatus,
    error: playerError,
    initializePlayer,
  } = useSpotifyPlayer(auth.accessToken);

  const [showScanner, setShowScanner] = useState(false);

  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const currentPlayerStatus = PLAYER_STATUS[playerStatus];

  /**
   * Erfolgreicher QR-Code-Scan.
   */
  const handleScan = (decodedText: string) => {
    setScannedCode(decodedText);
    setShowScanner(false);
  };

  /**
   * QR-Code-Scanner schließen.
   */
  const handleScannerClose = () => {
    setShowScanner(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <header className="mb-10 text-center">
          <h1 className="px-title text-5xl sm:text-6xl">YearWeGo</h1>
        </header>

        <div className="flex flex-col gap-8">
          <SpotifyAuth auth={auth} />

          {auth.isAuthenticated && (
            <section className="px-panel p-6">
              <h2 className="px-heading mb-4 text-xl">Spotify-Player</h2>

              <div className="px-slot mb-5 flex items-center gap-3 p-4">
                <span
                  className="px-dot"
                  style={{ backgroundColor: currentPlayerStatus.color }}
                  aria-hidden="true"
                />

                <p className="text-mist">
                  Status:{" "}
                  <span className="font-semibold text-white">
                    {currentPlayerStatus.label}
                  </span>
                </p>
              </div>

              {playerError && (
                <p role="alert" className="px-alert mb-5 p-4 text-sm">
                  {playerError}
                </p>
              )}

              <button
                onClick={initializePlayer}
                disabled={playerStatus === "loading" || playerStatus === "ready"}
                className="px-btn px-btn-grass"
              >
                {playerStatus === "loading"
                  ? "Player startet …"
                  : playerStatus === "ready"
                    ? "Player bereit"
                    : "Player starten"}
              </button>
            </section>
          )}

          {auth.isAuthenticated && (
            <section>
              {!showScanner ? (
                <button
                  onClick={() => setShowScanner(true)}
                  className="px-btn px-btn-mana py-5 text-xl"
                >
                  Karte scannen
                </button>
              ) : (
                <QRScanner
                  onScan={handleScan}
                  onError={(error) => {
                    console.error("QR-Scanner:", error);
                  }}
                  onClose={handleScannerClose}
                />
              )}
            </section>
          )}

          {scannedCode && (
            <section className="px-panel p-6">
              <h2 className="px-heading mb-4 text-lg">QR-Code erkannt</h2>

              <p className="px-slot p-4 font-mono text-sm break-all text-gold">
                {scannedCode}
              </p>

              <button
                onClick={() => {
                  setScannedCode(null);
                  setShowScanner(true);
                }}
                className="px-btn px-btn-wood mt-6"
              >
                Nächste Karte scannen
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}