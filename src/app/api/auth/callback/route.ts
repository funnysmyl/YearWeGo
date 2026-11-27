import { NextRequest, NextResponse } from "next/server";

import {
  SPOTIFY_CONFIG,
  getSpotifyAuthorizationHeader,
  validateSpotifyConfig,
} from "@/lib/spotify/auth";

/**
 * Antwort von Spotify beim erfolgreichen Token-Austausch.
 */
type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
};

/**
 * Verarbeitet die Rückkehr von Spotify.
 *
 * GET /api/auth/callback
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    validateSpotifyConfig();

    const searchParams = request.nextUrl.searchParams;

    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const spotifyError = searchParams.get("error");

    const savedState = request.cookies.get(
      "spotify_auth_state",
    )?.value;

    /**
     * Prüfen, ob Spotify einen Fehler zurückgegeben hat.
     */
    if (spotifyError) {
      return NextResponse.redirect(
        new URL(
          `/?authError=${encodeURIComponent(spotifyError)}`,
          request.url,
        ),
      );
    }

    /**
     * Prüfen, ob Authorization Code und State vorhanden sind.
     */
    if (!code || !returnedState || !savedState) {
      return NextResponse.json(
        {
          error: "Ungültige Spotify-Callback-Anfrage.",
        },
        {
          status: 400,
        },
      );
    }

    /**
     * CSRF-Schutz:
     * Der zurückgegebene State muss mit dem gespeicherten
     * State übereinstimmen.
     */
    if (returnedState !== savedState) {
      return NextResponse.json(
        {
          error: "Spotify State stimmt nicht überein.",
        },
        {
          status: 403,
        },
      );
    }

    /**
     * Authorization Code gegen Access Token tauschen.
     */
    const tokenResponse = await fetch(
      SPOTIFY_CONFIG.tokenUrl,
      {
        method: "POST",

        headers: {
          Authorization: getSpotifyAuthorizationHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_CONFIG.redirectUri!,
        }),

        cache: "no-store",
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();

      console.error(
        "Spotify Token Exchange fehlgeschlagen:",
        tokenResponse.status,
        errorText,
      );

      return NextResponse.json(
        {
          error: "Spotify-Token konnte nicht abgerufen werden.",
        },
        {
          status: 502,
        },
      );
    }

    const tokens =
      (await tokenResponse.json()) as SpotifyTokenResponse;

    /**
     * Ablaufzeit des Access Tokens berechnen.
     */
    const expiresAt =
      Date.now() + tokens.expires_in * 1000;

    /**
     * Zurück zur Startseite.
     */
    const response = NextResponse.redirect(
      new URL("/", request.url),
    );

    /**
     * Access Token als HttpOnly-Cookie speichern.
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
     * Refresh Token ebenfalls geschützt speichern.
     */
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

    /**
     * Ablaufzeit separat speichern.
     */
    response.cookies.set(
      "spotify_token_expires_at",
      String(expiresAt),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expires_in,
      },
    );

    /**
     * Temporären OAuth-State entfernen.
     */
    response.cookies.delete("spotify_auth_state");

    return response;
  } catch (error) {
    console.error("Spotify Callback Fehler:", error);

    return NextResponse.json(
      {
        error: "Spotify-Authentifizierung fehlgeschlagen.",
      },
      {
        status: 500,
      },
    );
  }
}