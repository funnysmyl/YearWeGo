import { NextRequest, NextResponse } from "next/server";

import {
  SPOTIFY_CONFIG,
  getMissingSpotifyConfig,
  getSpotifyAuthorizationHeader,
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
 * Entfernt den temporären OAuth-State.
 *
 * Wichtig: Der Pfad muss exakt dem Pfad beim Setzen
 * entsprechen ("/api/auth"), sonst wird das Cookie
 * nicht gelöscht.
 */
function clearStateCookie(response: NextResponse): void {
  response.cookies.set("spotify_auth_state", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });
}

/**
 * Leitet mit einem Fehlercode zurück zur Startseite.
 */
function redirectWithAuthError(
  request: NextRequest,
  code: string,
): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/?authError=${encodeURIComponent(code)}`, request.url),
  );

  clearStateCookie(response);

  return response;
}

/**
 * Verarbeitet die Rückkehr von Spotify.
 *
 * GET /api/auth/callback
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (getMissingSpotifyConfig().length > 0) {
    return redirectWithAuthError(request, "config_missing");
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const spotifyError = searchParams.get("error");

    const savedState = request.cookies.get("spotify_auth_state")?.value;

    /**
     * Spotify hat einen Fehler zurückgegeben,
     * z. B. "access_denied" bei Abbruch durch die Person.
     */
    if (spotifyError) {
      return redirectWithAuthError(request, spotifyError);
    }

    /**
     * Authorization Code und State müssen vorhanden sein.
     */
    if (!code || !returnedState || !savedState) {
      return redirectWithAuthError(request, "invalid_callback");
    }

    /**
     * CSRF-Schutz: zurückgegebener und gespeicherter
     * State müssen übereinstimmen.
     */
    if (returnedState !== savedState) {
      return redirectWithAuthError(request, "state_mismatch");
    }

    /**
     * Authorization Code gegen Access Token tauschen.
     */
    const tokenResponse = await fetch(SPOTIFY_CONFIG.tokenUrl, {
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
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();

      console.error(
        "Spotify Token Exchange fehlgeschlagen:",
        tokenResponse.status,
        errorText,
      );

      return redirectWithAuthError(request, "token_exchange_failed");
    }

    const tokens = (await tokenResponse.json()) as SpotifyTokenResponse;

    const expiresAt = Date.now() + tokens.expires_in * 1000;

    /**
     * Erfolgreich: zurück zur Startseite.
     */
    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set(
      "spotify_access_token",
      tokens.access_token,
      cookieOptions(tokens.expires_in),
    );

    response.cookies.set(
      "spotify_refresh_token",
      tokens.refresh_token,
      cookieOptions(365 * 24 * 60 * 60),
    );

    response.cookies.set(
      "spotify_token_expires_at",
      String(expiresAt),
      cookieOptions(tokens.expires_in),
    );

    clearStateCookie(response);

    return response;
  } catch (error) {
    console.error("Spotify Callback Fehler:", error);

    return redirectWithAuthError(request, "server_error");
  }
}