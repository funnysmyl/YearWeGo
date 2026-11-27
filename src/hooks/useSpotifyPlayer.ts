"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "not_ready"
  | "error";

type UseSpotifyPlayerReturn = {
  player: SpotifyWebPlaybackPlayer | null;
  deviceId: string | null;
  status: PlayerStatus;
  error: string | null;
  initializePlayer: () => Promise<void>;
  disconnectPlayer: () => void;
};

export function useSpotifyPlayer(
  accessToken: string | null,
): UseSpotifyPlayerReturn {
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);

  const accessTokenRef = useRef<string | null>(accessToken);

  const [player, setPlayer] =
    useState<SpotifyWebPlaybackPlayer | null>(null);

  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [status, setStatus] = useState<PlayerStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  /**
   * Access Token aktuell halten.
   *
   * Das SDK kann den Callback auch später erneut aufrufen.
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
        'script[src="https://sdk.scdn.co/spotify-player.js"]',
      );

      if (existingScript) {
        const previousCallback =
          window.onSpotifyWebPlaybackSDKReady;

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

      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;

      script.onerror = () => {
        reject(
          new Error("Spotify Web Playback SDK konnte nicht geladen werden."),
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
      setError("Kein Spotify Access Token vorhanden.");
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
        throw new Error("Spotify SDK ist nicht verfügbar.");
      }

      const newPlayer = new window.Spotify.Player({
        name: "Hitster DIY Player",

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
              throw new Error("Spotify Token konnte nicht geladen werden.");
            }

            const data = await response.json();

            accessTokenRef.current = data.access_token;

            callback(data.access_token);
          } catch (err) {
            console.error("Spotify Token Fehler:", err);
            setError("Spotify-Authentifizierung fehlgeschlagen.");
          }
        },
      });

      newPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setStatus("ready");
      });

      newPlayer.addListener(
        "not_ready",
        ({ device_id }: { device_id: string }) => {
          setDeviceId(null);
          setStatus("not_ready");

          console.warn("Spotify Player offline:", device_id);
        },
      );

      newPlayer.addListener(
        "initialization_error",
        ({ message }: { message: string }) => {
          setError(message);
          setStatus("error");
        },
      );

      newPlayer.addListener(
        "authentication_error",
        ({ message }: { message: string }) => {
          setError(message);
          setStatus("error");
        },
      );

      newPlayer.addListener(
        "account_error",
        ({ message }: { message: string }) => {
          setError(message);
          setStatus("error");
        },
      );

      newPlayer.addListener(
        "autoplay_failed",
        () => {
          setError(
            "Der Browser hat die automatische Wiedergabe blockiert. Bitte interagiere mit der Seite.",
          );
        },
      );

      playerRef.current = newPlayer;

      setPlayer(newPlayer);

      const connected = await newPlayer.connect();

      if (!connected) {
        throw new Error("Verbindung zum Spotify Player fehlgeschlagen.");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unbekannter Spotify Player Fehler.";

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