import { NextResponse } from "next/server";
import {
  createSpotifyAuthorizationUrl,
  generateState,
} from "@/lib/spotify/auth";

/**
 * Startet die Spotify-Authentifizierung.
 *
 * GET /api/auth/login
 */
export async function GET(): Promise<NextResponse> {
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

    return NextResponse.json(
      {
        error: "Spotify-Anmeldung konnte nicht gestartet werden.",
      },
      {
        status: 500,
      },
    );
  }
}