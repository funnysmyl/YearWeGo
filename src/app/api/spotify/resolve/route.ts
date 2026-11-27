import { NextRequest, NextResponse } from "next/server";

/**
 * Nur diese Hosts dürfen aufgelöst werden.
 * Verhindert, dass die Route als offener Proxy missbraucht wird.
 */
const ALLOWED_HOSTS = new Set(["spotify.link", "spotify.app.link"]);

const TRACK_URL_PATTERN =
  /open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?track\/([A-Za-z0-9]{22})(?![A-Za-z0-9])/i;

const TRACK_URI_PATTERN = /spotify:track:([A-Za-z0-9]{22})(?![A-Za-z0-9])/;

const MAX_BODY_LENGTH = 500_000;

function jsonNoStore(body: Record<string, unknown>, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

/**
 * Löst einen Spotify-Kurzlink (spotify.link/…) in eine Track-ID auf.
 *
 * GET /api/spotify/resolve?url=https://spotify.link/abc123
 *
 * Antwort: { trackId: "<22 Zeichen>" } oder { error: "…" }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return jsonNoStore({ error: "Es wurde kein Link übergeben." }, 400);
  }

  let target: URL;

  try {
    target = new URL(rawUrl);
  } catch {
    return jsonNoStore({ error: "Der Link ist ungültig." }, 400);
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    return jsonNoStore({ error: "Es werden nur Spotify-Kurzlinks unterstützt." }, 400);
  }

  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    /**
     * Fall 1: Die Weiterleitung endet direkt auf open.spotify.com.
     */
    const finalUrl = new URL(response.url);

    if (finalUrl.hostname.toLowerCase().endsWith("spotify.com")) {
      const trackMatch = response.url.match(TRACK_URL_PATTERN);

      if (trackMatch) {
        return jsonNoStore({ trackId: trackMatch[1] });
      }

      /**
       * Gelandet auf einem Album, einer Playlist o. Ä.
       * Die Seite wird bewusst nicht durchsucht, weil sie
       * viele Songs enthalten kann.
       */
      return jsonNoStore(
        { error: "Dieser Kurzlink führt nicht zu einem einzelnen Song." },
        422,
      );
    }

    /**
     * Fall 2: Die Weiterleitung erfolgt per HTML-Seite.
     * Dann steht der Ziel-Link im Seitentext.
     */
    const body = (await response.text()).slice(0, MAX_BODY_LENGTH);

    const bodyMatch = body.match(TRACK_URL_PATTERN) ?? body.match(TRACK_URI_PATTERN);

    if (bodyMatch) {
      return jsonNoStore({ trackId: bodyMatch[1] });
    }

    return jsonNoStore(
      { error: "Dieser Kurzlink führt nicht zu einem einzelnen Song." },
      422,
    );
  } catch (error) {
    console.error("Spotify-Kurzlink konnte nicht aufgelöst werden:", error);

    return jsonNoStore(
      { error: "Der Spotify-Kurzlink konnte nicht geöffnet werden." },
      502,
    );
  }
}