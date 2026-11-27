import { NextRequest, NextResponse } from "next/server";

import {
  SPOTIFY_CONFIG,
  getMissingSpotifyConfig,
  getSpotifyAuthorizationHeader,
} from "@/lib/spotify/auth";

/**
 * Antwort beim Erneuern eines Spotify-Tokens.
 */
type SpotifyRefreshResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
};

const isProduction = process.env.NODE_ENV === "production";

/**
 * Einheitliche Optionen für alle Auth-Cookies.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * JSON-Antwort, die niemals zwischengespeichert wird.
 */
function jsonNoStore(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  const response = NextResponse.json(body, { status });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

/**
 * Gibt einen gültigen Access Token zurück.
 *
 * GET /api/auth/token
 *
 * Falls der vorhandene Access Token abgelaufen ist,
 * wird automatisch ein neuer angefordert.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /**
   * Konfiguration zuerst prüfen, damit eine fehlende
   * Umgebungsvariable klar benannt wird.
   */
  const missing = getMissingSpotifyConfig();

  if (missing.length > 0) {
    console.error(
      "Spotify-Konfiguration unvollständig. Fehlend:",
      missing.join(", "),
    );

    return jsonNoStore(
      {
        code: "config_missing",
        error: `Server-Konfiguration unvollständig. Fehlende Umgebungsvariablen: ${missing.join(", ")}`,
      },
      500,
    );
  }

  try {
    const accessToken = request.cookies.get("spotify_access_token")?.value;

    const refreshToken = request.cookies.get("spotify_refresh_token")?.value;

    const expiresAt = Number(
      request.cookies.get("spotify_token_expires_at")?.value ?? 0,
    );

    /**
     * Gültigen Access Token direkt zurückgeben.
     *
     * Erneuerung erfolgt bereits 60 Sekunden
     * vor dem eigentlichen Ablauf.
     */
    if (accessToken && expiresAt > Date.now() + 60_000) {
      return jsonNoStore({
        access_token: accessToken,
        expires_at: expiresAt,
      });
    }

    /**
     * Ohne Refresh Token ist eine erneute Anmeldung notwendig.
     * Das ist kein Fehler, sondern der normale Zustand
     * vor dem ersten Login.
     */
    if (!refreshToken) {
      return jsonNoStore(
        {
          authenticated: false,
          code: "not_authenticated",
          error: "Keine gültige Spotify-Sitzung vorhanden.",
        },
        401,
      );
    }

    /**
     * Neuen Access Token über den Refresh Token anfordern.
     */
    const refreshResponse = await fetch(SPOTIFY_CONFIG.tokenUrl, {
      method: "POST",

      headers: {
        Authorization: getSpotifyAuthorizationHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),

      cache: "no-store",
    });

    if (!refreshResponse.ok) {
      console.error(
        "Spotify Token Refresh fehlgeschlagen:",
        refreshResponse.status,
      );

      const response = jsonNoStore(
        {
          authenticated: false,
          code: "refresh_failed",
          error: "Spotify-Sitzung abgelaufen. Bitte melde dich erneut an.",
        },
        401,
      );

      response.cookies.delete("spotify_access_token");
      response.cookies.delete("spotify_refresh_token");
      response.cookies.delete("spotify_token_expires_at");

      return response;
    }

    const tokens = (await refreshResponse.json()) as SpotifyRefreshResponse;

    const newExpiresAt = Date.now() + tokens.expires_in * 1000;

    /**
     * Access Token an das Frontend zurückgeben.
     * Der Refresh Token bleibt serverseitig im HttpOnly-Cookie.
     */
    const response = jsonNoStore({
      access_token: tokens.access_token,
      expires_at: newExpiresAt,
    });

    response.cookies.set(
      "spotify_access_token",
      tokens.access_token,
      cookieOptions(tokens.expires_in),
    );

    response.cookies.set(
      "spotify_token_expires_at",
      String(newExpiresAt),
      cookieOptions(tokens.expires_in),
    );

    /**
     * Spotify kann einen neuen Refresh Token mitschicken.
     * Falls nicht, bleibt der bisherige erhalten.
     */
    if (tokens.refresh_token) {
      response.cookies.set(
        "spotify_refresh_token",
        tokens.refresh_token,
        cookieOptions(365 * 24 * 60 * 60),
      );
    }

    return response;
  } catch (error) {
    console.error("Spotify Token Route Fehler:", error);

    return jsonNoStore(
      {
        code: "server_error",
        error:
          "Spotify ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      },
      502,
    );
  }
}