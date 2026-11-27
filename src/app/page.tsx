
"use client";

import { useState } from "react";

import SpotifyAuth from "@/components/auth/SpotifyAuth";

import QRScanner from "@/components/scanner/QRScanner";

import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";

import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

export default function Home() {
  const {
    accessToken,
    isAuthenticated,
  } = useSpotifyAuth();

  const {
    status: playerStatus,
    deviceId,
    error: playerError,
    initializePlayer,
  } = useSpotifyPlayer(accessToken);

  const [showScanner, setShowScanner] = useState(false);

  const [scannedCode, setScannedCode] = useState<string | null>(
    null,
  );

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
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-4 py-12 text-white">
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Hitster DIY
          </h1>

          <p className="mt-3 text-gray-400">
            Deine Musik. Deine Karten. Dein Spiel.
          </p>
        </header>

        <div className="flex flex-col items-center gap-8">
          <SpotifyAuth />

          {isAuthenticated && (
            <section className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6">
              <h2 className="mb-4 text-xl font-bold">
                Spotify Player
              </h2>

              <div className="mb-5 rounded-lg bg-gray-800 p-4">
                <p className="text-sm text-gray-400">
                  Player-Status
                </p>

                <p className="mt-1 font-medium">
                  {playerStatus}
                </p>

                {deviceId && (
                  <p className="mt-2 break-all text-xs text-gray-500">
                    Device ID: {deviceId}
                  </p>
                )}
              </div>

              {playerError && (
                <p
                  role="alert"
                  className="mb-4 text-sm text-red-400"
                >
                  {playerError}
                </p>
              )}

              <button
                onClick={initializePlayer}
                disabled={
                  playerStatus === "loading" ||
                  playerStatus === "ready"
                }
                className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {playerStatus === "loading"
                  ? "Player wird initialisiert ..."
                  : playerStatus === "ready"
                    ? "Player bereit"
                    : "Spotify Player initialisieren"}
              </button>
            </section>
          )}

          {isAuthenticated && (
            <section className="w-full max-w-md">
              {!showScanner ? (
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold transition hover:bg-blue-500"
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
            <section className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6">
              <h2 className="mb-3 text-lg font-bold">
                QR-Code erkannt
              </h2>

              <p className="break-all rounded-lg bg-gray-800 p-4 font-mono text-sm text-green-400">
                {scannedCode}
              </p>

              <button
                onClick={() => {
                  setScannedCode(null);
                  setShowScanner(true);
                }}
                className="mt-4 w-full rounded-lg border border-gray-600 px-4 py-3 text-sm transition hover:bg-gray-800"
              >
                Nächste Karte scannen
              </button>
            </section>
          )}
        </div>

        <footer className="mt-16 text-center text-xs text-gray-600">
          Hitster DIY – Private Music Game
        </footer>
      </div>
    </main>
  );
}




// import Image from "next/image";

