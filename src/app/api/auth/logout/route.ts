import { NextResponse } from "next/server";

/**
 * Beendet die lokale Spotify-Sitzung.
 *
 * POST /api/auth/logout
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({
    success: true,
    message: "Spotify-Sitzung wurde beendet.",
  });

  response.cookies.set("spotify_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("spotify_refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("spotify_token_expires_at", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}