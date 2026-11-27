"use client";

import { useEffect, useRef, useState } from "react";

type PlaybackPhase = "starting" | "started" | "failed";

type GameScreenProps = {
  isPlaying: boolean;

  /**
   * Fehlermeldung des Players, z. B. bei Wiedergabeproblemen.
   */
  errorMessage: string | null;

  /**
   * Startet den Song der Karte von Anfang an.
   * Gibt true zurück, wenn Spotify den Befehl angenommen hat.
   */
  onPlay: () => Promise<boolean>;

  onPause: () => Promise<void>;

  onResume: () => Promise<void>;

  onNextCard: () => void;
};

/**
 * Spieloberfläche im einfachen Modus.
 *
 * Zeigt bewusst keine Songinfos an. Die stehen auf der
 * Rückseite der physischen Karte.
 *
 * Wird pro Karte neu erzeugt (key = Runde) und startet
 * den Song beim Erscheinen automatisch.
 */
export default function GameScreen({
  isPlaying,
  errorMessage,
  onPlay,
  onPause,
  onResume,
  onNextCard,
}: GameScreenProps) {
  const [playback, setPlayback] = useState<PlaybackPhase>("starting");

  const [isBusy, setIsBusy] = useState(false);

  /**
   * Aktuelle onPlay-Funktion, damit der automatische Start
   * nur einmal beim Erscheinen ausgelöst wird.
   */
  const onPlayRef = useRef(onPlay);

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  /**
   * Song automatisch starten, sobald die Karte erkannt wurde.
   */
  useEffect(() => {
    let cancelled = false;

    void onPlayRef.current().then((started) => {
      if (!cancelled) {
        setPlayback(started ? "started" : "failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Hauptbutton: Abspielen, Pause oder Fortsetzen.
   */
  const handleMainButton = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      if (playback !== "started") {
        const started = await onPlay();

        setPlayback(started ? "started" : "failed");
      } else if (isPlaying) {
        await onPause();
      } else {
        await onResume();
      }
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Song von vorne starten.
   */
  const handleRestart = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      const started = await onPlay();

      setPlayback(started ? "started" : "failed");
    } finally {
      setIsBusy(false);
    }
  };

  const isRunning = playback === "started" && isPlaying;

  const mainLabel =
    playback === "starting"
      ? "Song startet …"
      : playback === "failed"
        ? "Song abspielen"
        : isPlaying
          ? "Pause"
          : "Abspielen";

  const statusLabel =
    playback === "starting"
      ? "Song startet …"
      : playback === "failed"
        ? "Nicht gestartet"
        : isPlaying
          ? "Song läuft"
          : "Pausiert";

  const statusColor =
    playback === "failed" ? "#c43c35" : isRunning ? "#4fae3a" : "#f7c843";

  return (
    <section className="px-panel p-6">
      <div className="px-slot p-6 text-center">
        <p className="px-title text-5xl">????</p>

        <div className="mt-5 flex items-center justify-center gap-2 text-mist">
          <span
            className="px-dot"
            style={{ backgroundColor: statusColor }}
            aria-hidden="true"
          />

          <span aria-live="polite">{statusLabel}</span>
        </div>

        <p className="mt-4 text-xs text-mist">
          Die Songinfos stehen auf der Rückseite deiner Karte.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="px-alert mt-5 p-4 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="mt-7 flex flex-col gap-5">
        <button
          onClick={handleMainButton}
          disabled={playback === "starting" || isBusy}
          className={`px-btn ${isRunning ? "px-btn-stone" : "px-btn-grass"} py-5 text-xl`}
        >
          {mainLabel}
        </button>

        {playback === "started" && (
          <button
            onClick={handleRestart}
            disabled={isBusy}
            className="px-btn px-btn-wood px-btn-small"
          >
            Von vorne
          </button>
        )}

        <button onClick={onNextCard} className="px-btn px-btn-mana py-5 text-xl">
          Nächste Karte
        </button>
      </div>
    </section>
  );
}