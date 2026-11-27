"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type SpotifyTokenResponse = {
  access_token: string;
  expires_at: number;
};

type SpotifyErrorResponse = {
  error?: string;
  code?: string;
};

export type UseSpotifyAuthReturn = {
  status: AuthStatus;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

/**
 * Lesbare Meldungen für Fehlercodes,
 * die von /api/auth/login und /api/auth/callback
 * per ?authError=... übergeben werden.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Die Spotify-Anmeldung wurde abgebrochen.",
  state_mismatch:
    "Die Anmeldung konnte nicht bestätigt werden. Bitte versuche es erneut.",
  invalid_callback:
    "Spotify hat eine unvollständige Antwort geschickt. Bitte versuche es erneut.",
  token_exchange_failed:
    "Spotify hat die Anmeldung abgelehnt. Prüfe die Redirect-URI im Spotify-Dashboard und ob dein Konto unter „User Management“ freigeschaltet ist.",
  config_missing:
    "Die Server-Konfiguration ist unvollständig. Prüfe die Umgebungsvariablen.",
  server_error: "Bei der Anmeldung ist ein Serverfehler aufgetreten.",
};

/**
 * Liest einen Fehlercode aus der URL, entfernt ihn
 * anschließend aus der Adresszeile und gibt die
 * passende Meldung zurück.
 */
function readAuthErrorFromUrl(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("authError");

  if (!code) {
    return null;
  }

  url.searchParams.delete("authError");

  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

  return (
    AUTH_ERROR_MESSAGES[code] ?? `Spotify-Anmeldung fehlgeschlagen (${code}).`
  );
}

export function useSpotifyAuth(): UseSpotifyAuthReturn {
  const [status, setStatus] = useState<AuthStatus>("loading");

  const [accessToken, setAccessToken] = useState<string | null>(null);

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
        /**
         * 401 = nicht angemeldet. Das ist vor dem ersten
         * Login der Normalfall und kein Fehler.
         */
        if (response.status === 401) {
          setAccessToken(null);
          setStatus("unauthenticated");

          return null;
        }

        /**
         * Andere Fehler: Meldung des Servers übernehmen,
         * damit z. B. fehlende Umgebungsvariablen
         * konkret benannt werden.
         */
        const data = (await response
          .json()
          .catch(() => ({}))) as SpotifyErrorResponse;

        throw new Error(
          data.error ??
            `Spotify-Token konnte nicht abgerufen werden (HTTP ${response.status}).`,
        );
      }

      const data = (await response.json()) as SpotifyTokenResponse;

      if (!data.access_token) {
        throw new Error("Kein gültiger Access Token erhalten.");
      }

      setAccessToken(data.access_token);
      setStatus("authenticated");

      return data.access_token;
    } catch (err) {
      /**
       * fetch wirft einen TypeError, wenn der Server
       * gar nicht erreichbar ist (z. B. offline).
       */
      const message =
        err instanceof TypeError
          ? "Keine Verbindung zum Server. Prüfe deine Internetverbindung."
          : err instanceof Error
            ? err.message
            : "Unbekannter Authentifizierungsfehler.";

      setError(message);
      setAccessToken(null);
      setStatus("unauthenticated");

      return null;
    }
  }, []);

  /**
   * Beim ersten Laden: bestehende Sitzung prüfen und
   * einen eventuellen Fehler aus der Anmeldung anzeigen.
   */
  useEffect(() => {
    const initialize = async () => {
      const urlError = readAuthErrorFromUrl();

      await refreshToken();

      if (urlError) {
        setError(urlError);
      }
    };

    void initialize();
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
        err instanceof Error ? err.message : "Abmeldung fehlgeschlagen.";

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