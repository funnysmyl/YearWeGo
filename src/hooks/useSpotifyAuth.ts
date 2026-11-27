"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";

type SpotifyTokenResponse = {
  access_token: string;
  expires_at: number;
};

type UseSpotifyAuthReturn = {
  status: AuthStatus;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

export function useSpotifyAuth(): UseSpotifyAuthReturn {
  const [status, setStatus] = useState<AuthStatus>("loading");

  const [accessToken, setAccessToken] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  /**
   * Fordert einen gültigen Access Token vom Backend an.
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      setError(null);

      const response = await fetch("/api/auth/token", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) {
          setAccessToken(null);
          setStatus("unauthenticated");

          return null;
        }

        throw new Error(
          "Spotify-Token konnte nicht abgerufen werden.",
        );
      }

      const data =
        (await response.json()) as SpotifyTokenResponse;

      if (!data.access_token) {
        throw new Error("Kein gültiger Access Token erhalten.");
      }

      setAccessToken(data.access_token);
      setStatus("authenticated");

      return data.access_token;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unbekannter Authentifizierungsfehler.";

      setError(message);
      setAccessToken(null);
      setStatus("unauthenticated");

      return null;
    }
  }, []);

  /**
   * Prüft beim ersten Laden, ob bereits eine Spotify-Sitzung besteht.
   */
  useEffect(() => {
    void refreshToken();
  }, [refreshToken]);

  /**
   * Beendet die lokale Spotify-Sitzung.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Abmeldung fehlgeschlagen.");
      }

      setAccessToken(null);
      setStatus("unauthenticated");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Abmeldung fehlgeschlagen.";

      setError(message);

      throw err;
    }
  }, []);

  return {
    status,
    accessToken,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    error,
    refreshToken,
    logout,
  };
}