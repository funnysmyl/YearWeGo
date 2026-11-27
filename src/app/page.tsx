"use client";

import { useEffect, useReducer, useRef } from "react";

import SpotifyAuth from "@/components/auth/SpotifyAuth";

import GameScreen from "@/components/game/GameScreen";

import QRScanner from "@/components/scanner/QRScanner";

import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";

import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

import { gameReducer, initialGameState } from "@/lib/game/gameState";

import { findSongByCardId } from "@/lib/game/songDatabase";

import { parseQRCode } from "@/lib/scanner/parseQR";

import { SpotifyApiError, resolveShortLink } from "@/lib/spotify/client";

import type { SpotifyTrackUri } from "@/types/song";

/**
 * Anzeige-Texte und Farben für den Player-Status.
 */
const PLAYER_STATUS = {
  idle: { label: "Wird verbunden …", color: "#f7c843" },
  loading: { label: "Wird verbunden …", color: "#f7c843" },
  ready: { label: "Bereit", color: "#4fae3a" },
  not_ready: { label: "Offline", color: "#e08a35" },
  error: { label: "Fehler", color: "#c43c35" },
} as const;

/**
 * Maximale Länge, mit der ein gelesener QR-Inhalt
 * in einer Fehlermeldung angezeigt wird.
 */
const MAX_SHOWN_CODE_LENGTH = 80;

/**
 * Kürzt den gelesenen QR-Inhalt für die Anzeige.
 */
function shortenScannedText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");

  if (trimmed.length <= MAX_SHOWN_CODE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_SHOWN_CODE_LENGTH)}…`;
}

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
    isPlaying,
    initializePlayer,
    disconnectPlayer,
    primePlayback,
    playTrack,
    pausePlayback,
    resumePlayback,
  } = useSpotifyPlayer(auth.accessToken);

  const [game, dispatch] = useReducer(gameReducer, initialGameState);

  /**
   * Bereits abgelehnte QR-Inhalte samt Fehlermeldung.
   * Verhindert, dass derselbe ungültige Code erneut
   * ausgewertet oder ein Kurzlink mehrfach aufgelöst wird.
   */
  const rejectedCodesRef = useRef<Map<string, string>>(new Map());

  const currentPlayerStatus = PLAYER_STATUS[playerStatus];

  const isPlayerReady = playerStatus === "ready";

  /**
   * Player nach der Anmeldung automatisch verbinden.
   */
  useEffect(() => {
    if (auth.isAuthenticated && playerStatus === "idle") {
      void initializePlayer();
    }
  }, [auth.isAuthenticated, playerStatus, initializePlayer]);

  /**
   * Code ablehnen und Meldung anzeigen.
   */
  const rejectCode = (decodedText: string, message: string) => {
    rejectedCodesRef.current.set(decodedText, message);

    dispatch({ type: "SCAN_REJECTED", message });
  };

  /**
   * Runde mit einem Spotify-Track starten.
   * Der Song startet automatisch, sobald die Spieloberfläche erscheint.
   */
  const startRound = (spotifyTrackUri: SpotifyTrackUri, cardId: string | null) => {
    dispatch({
      type: "CARD_SCANNED",
      card: { spotifyTrackUri, cardId },
    });
  };

  /**
   * Gescannten QR-Code auswerten.
   *
   * true  = Code angenommen, Scanner schließt.
   * false = Code abgelehnt, Scanner sucht weiter.
   */
  const handleScan = (decodedText: string): boolean => {
    const knownError = rejectedCodesRef.current.get(decodedText);

    if (knownError) {
      dispatch({ type: "SCAN_REJECTED", message: knownError });
      return false;
    }

    const parsed = parseQRCode(decodedText);

    switch (parsed.kind) {
      case "invalid":
        /**
         * Gelesenen Inhalt mit anzeigen, damit z. B. Weiterleitungs-Links
         * von QR-Generatoren sofort erkennbar sind.
         */
        rejectCode(
          decodedText,
          `${parsed.reason} Gelesen: „${shortenScannedText(decodedText)}“`,
        );
        return false;

      case "spotify":
        startRound(parsed.spotifyTrackUri, null);
        return true;

      case "card": {
        /**
         * Eigene Karten-IDs (z. B. hitster://song/001) brauchen
         * einen Eintrag in songs.json, um den Song zu finden.
         */
        const song = findSongByCardId(parsed.cardId);

        if (!song) {
          rejectCode(decodedText, `Karte „${parsed.cardId}“ ist nicht in der Songliste.`);
          return false;
        }

        startRound(song.spotifyTrackUri, parsed.cardId);
        return true;
      }

      case "shortlink":
        dispatch({ type: "RESOLVE_STARTED" });

        void resolveShortLink(parsed.url)
          .then((trackUri) => startRound(trackUri, null))
          .catch((err: unknown) => {
            const message =
              err instanceof SpotifyApiError
                ? err.message
                : "Der Spotify-Kurzlink konnte nicht geöffnet werden.";

            /**
             * Nur dauerhafte Fehler merken, keine Netzwerkprobleme.
             */
            if (err instanceof SpotifyApiError && err.status < 500) {
              rejectedCodesRef.current.set(decodedText, message);
            }

            dispatch({ type: "RESOLVE_FAILED", message });
          });

        return true;

      default:
        return false;
    }
  };

  /**
   * "Karte scannen": Tonausgabe freischalten und Kamera öffnen.
   * Das Freischalten muss direkt im Tipp passieren, damit der
   * Song nach dem Scan ohne weiteren Tipp starten darf.
   */
  const handleStartScan = () => {
    primePlayback();

    dispatch({ type: "START_SCAN" });
  };

  /**
   * "Nächste Karte": Tonausgabe freischalten, Musik stoppen
   * und Kamera direkt öffnen.
   */
  const handleNextCard = () => {
    primePlayback();

    void pausePlayback();

    dispatch({ type: "NEXT_CARD" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <header className="mb-10 text-center">
          <h1 className="px-title text-5xl sm:text-6xl">YearWeGo</h1>
        </header>

        <div className="flex flex-col gap-8">
          <SpotifyAuth auth={auth} />

          {auth.isAuthenticated &&
            (isPlayerReady ? (
              <div className="px-success flex items-center gap-3 p-4">
                <span
                  className="px-dot"
                  style={{ backgroundColor: currentPlayerStatus.color }}
                  aria-hidden="true"
                />

                <span className="font-semibold">Spotify-Player bereit</span>
              </div>
            ) : (
              <section className="px-panel p-6">
                <h2 className="px-heading mb-4 text-xl">Spotify-Player</h2>

                <div className="px-slot flex items-center gap-3 p-4">
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

                {playerError && game.phase !== "round" && (
                  <p role="alert" className="px-alert mt-5 p-4 text-sm">
                    {playerError}
                  </p>
                )}

                {(playerStatus === "error" || playerStatus === "not_ready") && (
                  <button
                    onClick={disconnectPlayer}
                    className="px-btn px-btn-grass mt-6"
                  >
                    Player neu verbinden
                  </button>
                )}
              </section>
            ))}

          {auth.isAuthenticated && game.phase === "idle" && (
            <button
              onClick={handleStartScan}
              disabled={!isPlayerReady}
              className="px-btn px-btn-mana py-5 text-xl"
            >
              {isPlayerReady ? "Karte scannen" : "Player verbindet …"}
            </button>
          )}

          {auth.isAuthenticated && game.phase === "scanning" && (
            <section className="flex flex-col gap-5">
              {game.errorMessage && (
                <div role="alert" className="px-alert p-4 text-sm break-all">
                  {game.errorMessage}
                </div>
              )}

              <QRScanner
                onScan={handleScan}
                onClose={() => dispatch({ type: "CANCEL_SCAN" })}
              />
            </section>
          )}

          {auth.isAuthenticated && game.phase === "resolving" && (
            <section className="px-panel p-6 text-center">
              <p className="px-heading text-lg">Spotify-Link wird geöffnet …</p>

              <button
                onClick={() => dispatch({ type: "CANCEL_SCAN" })}
                className="px-btn px-btn-wood px-btn-small mt-6"
              >
                Abbrechen
              </button>
            </section>
          )}

          {auth.isAuthenticated && game.phase === "round" && game.card && (
            <GameScreen
              key={game.round}
              isPlaying={isPlaying}
              errorMessage={playerError}
              onPlay={() => playTrack(game.card!.spotifyTrackUri)}
              onPause={pausePlayback}
              onResume={resumePlayback}
              onNextCard={handleNextCard}
            />
          )}
        </div>
      </div>
    </main>
  );
}