"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PlayerStatus = "idle" | "loading" | "ready" | "not_ready" | "error";

type UseSpotifyPlayerReturn = {
  player: SpotifyWebPlaybackPlayer | null;
  deviceId: string | null;
  status: PlayerStatus;
  error: string | null;
  initializePlayer: () => Promise<void>;
  disconnectPlayer: () => void;
};

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

/**
 * Verständliche Meldungen für die Fehler-Ereignisse des SDK.
 * Die technische Originalmeldung landet zusätzlich in der Konsole.
 */
const PLAYER_ERROR_MESSAGES: Record<SpotifyPlayerErrorEvent, string> = {
  initialization_error:
    "Der Spotify-Player konnte in diesem Browser nicht gestartet werden.",
  authentication_error:
    "Spotify hat den Player nicht zugelassen. Bitte melde dich ab und erneut an.",
  account_error: "Für die Wiedergabe wird ein Spotify-Premium-Konto benötigt.",
  playback_error: "Der Song konnte nicht abgespielt werden.",
};

export function useSpotifyPlayer(
  accessToken: string | null,
): UseSpotifyPlayerReturn {
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);

  const accessTokenRef = useRef<string | null>(accessToken);

  const [player, setPlayer] = useState<SpotifyWebPlaybackPlayer | null>(null);

  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [status, setStatus] = useState<PlayerStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  /**
   * Access Token aktuell halten.
   *
   * Das SDK kann den Token-Callback auch später erneut aufrufen.
   */
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

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
    if (!accessTokenRef.current) {
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
            const response = await fetch("/api/auth/token", {
              credentials: "same-origin",
              cache: "no-store",
            });

            if (!response.ok) {
              throw new Error(`Token-Abruf fehlgeschlagen (HTTP ${response.status})`);
            }

            const data = (await response.json()) as { access_token?: string };

            if (!data.access_token) {
              throw new Error("Antwort enthielt keinen Access Token.");
            }

            accessTokenRef.current = data.access_token;

            callback(data.access_token);
          } catch (err) {
            /**
             * Ohne Token kann das SDK nicht weiterarbeiten.
             * Status sichtbar auf Fehler setzen, statt
             * dauerhaft "Wird gestartet …" anzuzeigen.
             */
            console.error("Spotify Token Fehler:", err);

            setError("Spotify-Sitzung abgelaufen. Bitte melde dich erneut an.");
            setStatus("error");
          }
        },
      });

      newPlayer.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setError(null);
        setStatus("ready");
      });

      newPlayer.addListener("not_ready", ({ device_id }) => {
        console.warn("Spotify Player offline:", device_id);

        setDeviceId(null);
        setStatus("not_ready");
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

          setError(PLAYER_ERROR_MESSAGES[eventName]);

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
          "Der Browser hat die automatische Wiedergabe blockiert. Tippe bitte erneut auf Abspielen.",
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

      setPlayer(null);
      setError(message);
      setStatus("error");
    }
  }, [loadSpotifySDK]);

  /**
   * Player sauber trennen.
   */
  const disconnectPlayer = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();

      playerRef.current = null;

      setPlayer(null);
      setDeviceId(null);
      setStatus("idle");
    }
  }, []);

  /**
   * Beim Unmount Player aufräumen.
   */
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  /**
   * Player bei Abmeldung automatisch trennen.
   */
  useEffect(() => {
    if (!accessToken) {
      disconnectPlayer();
    }
  }, [accessToken, disconnectPlayer]);

  return {
    player,
    deviceId,
    status,
    error,
    initializePlayer,
    disconnectPlayer,
  };
}