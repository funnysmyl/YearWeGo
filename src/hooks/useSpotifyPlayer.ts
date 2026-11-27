"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SpotifyApiError,
  fetchAccessToken,
  playTrackOnDevice,
} from "@/lib/spotify/client";

import type { SpotifyTrackUri } from "@/types/song";

export type PlayerStatus = "idle" | "loading" | "ready" | "not_ready" | "error";

type UseSpotifyPlayerReturn = {
  player: SpotifyWebPlaybackPlayer | null;
  deviceId: string | null;
  status: PlayerStatus;
  error: string | null;

  /**
   * Läuft gerade Musik?
   */
  isPlaying: boolean;

  /**
   * Aktueller Track laut Player.
   * Wird im einfachen Modus nicht angezeigt (Spoilerschutz),
   * steht aber für spätere Spielmodi bereit.
   */
  currentTrack: SpotifyWebPlaybackTrack | null;

  initializePlayer: () => Promise<void>;
  disconnectPlayer: () => void;

  /**
   * Schaltet die Tonausgabe auf Mobilgeräten frei.
   * Muss direkt in einem Tipp-Ereignis aufgerufen werden.
   * Danach darf der Song auch ohne weiteren Tipp starten.
   */
  primePlayback: () => void;

  /**
   * Spielt einen Track von Anfang an ab.
   * Gibt true zurück, wenn Spotify den Befehl angenommen hat.
   */
  playTrack: (trackUri: SpotifyTrackUri) => Promise<boolean>;

  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
};

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

/**
 * Verständliche Meldungen für die Fehler-Ereignisse des SDK.
 * Die technische Originalmeldung wird zur Fehlersuche angehängt.
 */
const PLAYER_ERROR_MESSAGES: Record<SpotifyPlayerErrorEvent, string> = {
  initialization_error:
    "Der Spotify-Player konnte in diesem Browser nicht gestartet werden.",
  authentication_error:
    "Spotify hat den Player nicht zugelassen. Bitte melde dich ab und erneut an.",
  account_error: "Für die Wiedergabe wird ein Spotify-Premium-Konto benötigt.",
  playback_error: "Der Song konnte nicht abgespielt werden.",
};

/**
 * Wandelt Fehler beim Abspielen in eine verständliche Meldung um.
 */
function getPlaybackErrorMessage(err: unknown): string {
  if (err instanceof SpotifyApiError) {
    return err.message;
  }

  if (err instanceof TypeError) {
    return "Keine Verbindung. Prüfe deine Internetverbindung.";
  }

  return "Der Song konnte nicht gestartet werden.";
}

export function useSpotifyPlayer(
  accessToken: string | null,
): UseSpotifyPlayerReturn {
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);

  const deviceIdRef = useRef<string | null>(null);

  const [player, setPlayer] = useState<SpotifyWebPlaybackPlayer | null>(null);

  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [status, setStatus] = useState<PlayerStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTrack, setCurrentTrack] =
    useState<SpotifyWebPlaybackTrack | null>(null);

  /**
   * Spotify SDK dynamisch laden.
   */
  const loadSpotifySDK = useCallback(async (): Promise<void> => {
    if (window.Spotify) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${SDK_URL}"]`,
      );

      if (existingScript) {
        const previousCallback = window.onSpotifyWebPlaybackSDKReady;

        window.onSpotifyWebPlaybackSDKReady = () => {
          previousCallback?.();
          resolve();
        };

        existingScript.addEventListener(
          "error",
          () => reject(new Error("Spotify SDK konnte nicht geladen werden.")),
          { once: true },
        );

        return;
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        resolve();
      };

      const script = document.createElement("script");

      script.src = SDK_URL;
      script.async = true;

      script.onerror = () => {
        reject(
          new Error(
            "Spotify-Player konnte nicht geladen werden. Prüfe deine Internetverbindung.",
          ),
        );
      };

      document.body.appendChild(script);
    });
  }, []);

  /**
   * Spotify Player initialisieren und verbinden.
   */
  const initializePlayer = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setError("Bitte melde dich zuerst bei Spotify an.");
      setStatus("error");
      return;
    }

    if (playerRef.current) {
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      await loadSpotifySDK();

      if (!window.Spotify) {
        throw new Error("Spotify-Player ist nicht verfügbar.");
      }

      const newPlayer = new window.Spotify.Player({
        name: "YearWeGo Player",

        volume: 0.5,

        getOAuthToken: async (callback) => {
          try {
            /**
             * Immer einen aktuellen Token vom Backend anfordern.
             */
            const token = await fetchAccessToken();

            callback(token);
          } catch (err) {
            /**
             * Ohne Token kann das SDK nicht weiterarbeiten.
             * Status sichtbar auf Fehler setzen, statt
             * dauerhaft "Wird verbunden …" anzuzeigen.
             */
            console.error("Spotify Token Fehler:", err);

            setError("Spotify-Sitzung abgelaufen. Bitte melde dich erneut an.");
            setStatus("error");
          }
        },
      });

      newPlayer.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;

        setDeviceId(device_id);
        setError(null);
        setStatus("ready");
      });

      newPlayer.addListener("not_ready", ({ device_id }) => {
        console.warn("Spotify Player offline:", device_id);

        deviceIdRef.current = null;

        setDeviceId(null);
        setStatus("not_ready");
      });

      /**
       * Wiedergabezustand verfolgen (läuft / pausiert / welcher Track).
       */
      newPlayer.addListener("player_state_changed", (state) => {
        if (!state) {
          setIsPlaying(false);
          return;
        }

        const playing = !state.paused;

        setIsPlaying(playing);
        setCurrentTrack(state.track_window.current_track);

        /**
         * Läuft die Musik tatsächlich, sind ältere
         * Fehlermeldungen überholt.
         */
        if (playing) {
          setError(null);
        }
      });

      const errorEvents: SpotifyPlayerErrorEvent[] = [
        "initialization_error",
        "authentication_error",
        "account_error",
        "playback_error",
      ];

      for (const eventName of errorEvents) {
        newPlayer.addListener(eventName, ({ message }) => {
          console.error(`Spotify ${eventName}:`, message);

          /**
           * Originalmeldung von Spotify anhängen,
           * damit sich Ursachen eindeutig erkennen lassen.
           */
          setError(
            message
              ? `${PLAYER_ERROR_MESSAGES[eventName]} (Spotify: ${message})`
              : PLAYER_ERROR_MESSAGES[eventName],
          );

          /**
           * Ein Wiedergabefehler betrifft nur den einzelnen Song,
           * der Player selbst bleibt einsatzbereit.
           */
          if (eventName !== "playback_error") {
            setStatus("error");
          }
        });
      }

      newPlayer.addListener("autoplay_failed", () => {
        setError(
          "Der Browser hat den automatischen Start blockiert. Tippe auf „Abspielen“.",
        );
      });

      playerRef.current = newPlayer;

      setPlayer(newPlayer);

      const connected = await newPlayer.connect();

      if (!connected) {
        throw new Error("Verbindung zum Spotify-Player fehlgeschlagen.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler im Spotify-Player.";

      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;

      setPlayer(null);
      setError(message);
      setStatus("error");
    }
  }, [accessToken, loadSpotifySDK]);

  /**
   * Tonausgabe freischalten (Mobilgeräte).
   */
  const primePlayback = useCallback((): void => {
    const activePlayer = playerRef.current;

    if (!activePlayer) {
      return;
    }

    void activePlayer.activateElement().catch(() => undefined);
  }, []);

  /**
   * Spielt einen Track von Anfang an ab.
   */
  const playTrack = useCallback(
    async (trackUri: SpotifyTrackUri): Promise<boolean> => {
      const activePlayer = playerRef.current;
      const activeDeviceId = deviceIdRef.current;

      if (!activePlayer || !activeDeviceId) {
        setError("Der Spotify-Player ist noch nicht bereit.");
        return false;
      }

      /**
       * Wird dies direkt in einem Tipp-Ereignis aufgerufen,
       * schaltet es die Tonausgabe frei. Außerhalb eines Tipps
       * schadet der Aufruf nicht.
       */
      void activePlayer.activateElement().catch(() => undefined);

      try {
        setError(null);

        await playTrackOnDevice(activeDeviceId, trackUri);

        return true;
      } catch (err) {
        console.error("Wiedergabe fehlgeschlagen:", err);

        setError(getPlaybackErrorMessage(err));

        return false;
      }
    },
    [],
  );

  /**
   * Wiedergabe pausieren.
   *
   * Nur wenn tatsächlich ein Song geladen ist. Eine Pause
   * ins Leere löst im SDK sonst einen unnötigen playback_error aus.
   */
  const pausePlayback = useCallback(async (): Promise<void> => {
    const activePlayer = playerRef.current;

    if (!activePlayer) {
      return;
    }

    try {
      const state = await activePlayer.getCurrentState();

      if (!state || state.paused) {
        return;
      }

      await activePlayer.pause();
    } catch (err) {
      console.error("Pause fehlgeschlagen:", err);
    }
  }, []);

  /**
   * Wiedergabe fortsetzen.
   */
  const resumePlayback = useCallback(async (): Promise<void> => {
    const activePlayer = playerRef.current;

    if (!activePlayer) {
      return;
    }

    void activePlayer.activateElement().catch(() => undefined);

    try {
      setError(null);

      await activePlayer.resume();
    } catch (err) {
      console.error("Fortsetzen fehlgeschlagen:", err);

      setError("Die Wiedergabe konnte nicht fortgesetzt werden.");
    }
  }, []);

  /**
   * Player sauber trennen.
   */
  const disconnectPlayer = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();
    }

    playerRef.current = null;
    deviceIdRef.current = null;

    setPlayer(null);
    setDeviceId(null);
    setIsPlaying(false);
    setCurrentTrack(null);
    setError(null);
    setStatus("idle");
  }, []);

  /**
   * Beim Unmount Player aufräumen.
   */
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, []);

  /**
   * Player bei Abmeldung automatisch trennen.
   */
  useEffect(() => {
    if (!accessToken && playerRef.current) {
      disconnectPlayer();
    }
  }, [accessToken, disconnectPlayer]);

  return {
    player,
    deviceId,
    status,
    error,
    isPlaying,
    currentTrack,
    initializePlayer,
    disconnectPlayer,
    primePlayback,
    playTrack,
    pausePlayback,
    resumePlayback,
  };
}