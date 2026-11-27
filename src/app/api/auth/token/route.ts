import { NextRequest, NextResponse } from "next/server";

import {
  SPOTIFY_CONFIG,
  getSpotifyAuthorizationHeader,
  validateSpotifyConfig,
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

/**
 * Gibt einen gültigen Access Token zurück.
 *
 * GET /api/auth/token
 *
 * Falls der vorhandene Access Token abgelaufen ist,
 * wird automatisch ein neuer angefordert.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    validateSpotifyConfig();

    const accessToken = request.cookies.get(
      "spotify_access_token",
    )?.value;

    const refreshToken = request.cookies.get(
      "spotify_refresh_token",
    )?.value;

    const expiresAt = Number(
      request.cookies.get(
        "spotify_token_expires_at",
      )?.value ?? 0,
    );

    /**
     * Prüfen, ob ein gültiger Access Token existiert.
     *
     * Wir erneuern den Token bereits 60 Sekunden
     * vor seinem eigentlichen Ablauf.
     */
    if (
      accessToken &&
      expiresAt > Date.now() + 60_000
    ) {
      const response = NextResponse.json({
        access_token: accessToken,
        expires_at: expiresAt,
      });

      response.headers.set("Cache-Control", "no-store");

      return response;
    }

    /**
     * Ohne Refresh Token ist eine erneute Anmeldung notwendig.
     */
    if (!refreshToken) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "Keine gültige Spotify-Sitzung vorhanden.",
        },
        {
          status: 401,
        },
      );
    }

    /**
     * Neuen Access Token über den Refresh Token anfordern.
     */
    const refreshResponse = await fetch(
      SPOTIFY_CONFIG.tokenUrl,
      {
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
      },
    );

    if (!refreshResponse.ok) {
      console.error(
        "Spotify Token Refresh fehlgeschlagen:",
        refreshResponse.status,
      );

      const response = NextResponse.json(
        {
          authenticated: false,
          error: "Spotify-Sitzung konnte nicht erneuert werden.",
        },
        {
          status: 401,
        },
      );

      response.cookies.delete("spotify_access_token");
      response.cookies.delete("spotify_refresh_token");
      response.cookies.delete("spotify_token_expires_at");

      return response;
    }

    const tokens =
      (await refreshResponse.json()) as SpotifyRefreshResponse;

    const newExpiresAt =
      Date.now() + tokens.expires_in * 1000;

    /**
     * Access Token an das Frontend zurückgeben.
     *
     * Das Frontend erhält den Token im JSON-Response.
     * Der Refresh Token bleibt serverseitig.
     */
    const response = NextResponse.json({
      access_token: tokens.access_token,
      expires_at: newExpiresAt,
    });

    response.headers.set("Cache-Control", "no-store");

    /**
     * Neuen Access Token speichern.
     */
    response.cookies.set(
      "spotify_access_token",
      tokens.access_token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expires_in,
      },
    );

    /**
     * Ablaufzeit aktualisieren.
     */
    response.cookies.set(
      "spotify_token_expires_at",
      String(newExpiresAt),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expires_in,
      },
    );

    /**
     * Spotify kann bei einer Token-Erneuerung
     * einen neuen Refresh Token zurückgeben.
     *
     * Falls nicht, bleibt der bisherige erhalten.
     */
    if (tokens.refresh_token) {
      response.cookies.set(
        "spotify_refresh_token",
        tokens.refresh_token,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 365 * 24 * 60 * 60,
        },
      );
    }

    return response;
  } catch (error) {
    console.error("Spotify Token Route Fehler:", error);

    return NextResponse.json(
      {
        error: "Spotify-Token konnte nicht abgerufen werden.",
      },
      {
        status: 500,
      },
    );
  }
}