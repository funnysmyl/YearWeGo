import { NextRequest, NextResponse } from "next/server";

import {
  createSpotifyAuthorizationUrl,
  generateState,
  getMissingSpotifyConfig,
} from "@/lib/spotify/auth";

/**
 * Leitet mit einem Fehlercode zurück zur Startseite.
 * Die Startseite übersetzt den Code in eine lesbare Meldung.
 */
function redirectWithAuthError(
  request: NextRequest,
  code: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(`/?authError=${encodeURIComponent(code)}`, request.url),
  );
}

/**
 * Startet die Spotify-Authentifizierung.
 *
 * GET /api/auth/login
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const missing = getMissingSpotifyConfig();

  if (missing.length > 0) {
    console.error(
      "Spotify Login nicht möglich. Fehlende Umgebungsvariablen:",
      missing.join(", "),
    );

    return redirectWithAuthError(request, "config_missing");
  }

  try {
    const state = generateState();

    const authorizationUrl = createSpotifyAuthorizationUrl(state);

    const response = NextResponse.redirect(authorizationUrl);

    /**
     * State wird temporär in einem HttpOnly-Cookie gespeichert.
     *
     * Bei der Rückkehr von Spotify wird geprüft,
     * ob der zurückgegebene State übereinstimmt.
     */
    response.cookies.set("spotify_auth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("Spotify Login Fehler:", error);

    return redirectWithAuthError(request, "server_error");
  }
}