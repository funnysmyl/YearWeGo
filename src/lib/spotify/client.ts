import type { SpotifyTrackUri } from "@/types/song";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";

/**
 * Fehler bei der Kommunikation mit Spotify.
 * Die message ist bereits eine verständliche deutsche Meldung.
 */
export class SpotifyApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);

    this.name = "SpotifyApiError";
    this.status = status;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Holt einen gültigen Access Token vom eigenen Backend.
 * Das Backend erneuert abgelaufene Tokens automatisch.
 */
export async function fetchAccessToken(): Promise<string> {
  const response = await fetch("/api/auth/token", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new SpotifyApiError(
        401,
        "Spotify-Sitzung abgelaufen. Bitte melde dich erneut an.",
      );
    }

    throw new SpotifyApiError(
      response.status,
      "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
    );
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new SpotifyApiError(500, "Kein gültiger Spotify-Token erhalten.");
  }

  return data.access_token;
}

/**
 * Führt eine Anfrage an die Spotify Web API aus.
 */
async function spotifyFetch(
  path: string,
  method: "GET" | "PUT" | "POST",
  body?: unknown,
): Promise<Response> {
  const token = await fetchAccessToken();

  return fetch(`${SPOTIFY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}

/**
 * Liest die Fehlermeldung aus einer Spotify-Antwort.
 */
async function readSpotifyErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string; reason?: string };
    };

    return `${data.error?.reason ?? ""} ${data.error?.message ?? ""}`.trim();
  } catch {
    return "";
  }
}

/**
 * Übersetzt HTTP-Statuscodes der Wiedergabe in verständliche Meldungen.
 */
function describePlaybackError(status: number, detail: string): string {
  if (status === 400) {
    return "Spotify konnte den Song nicht laden. Prüfe den Link auf dieser Karte.";
  }

  if (status === 401) {
    return "Spotify-Sitzung abgelaufen. Bitte melde dich erneut an.";
  }

  if (status === 403) {
    if (/premium/i.test(detail)) {
      return "Für die Wiedergabe wird ein Spotify-Premium-Konto benötigt.";
    }

    return "Spotify erlaubt die Wiedergabe dieses Songs gerade nicht.";
  }

  if (status === 404) {
    return "Spotify findet den Player nicht. Lade die Seite neu.";
  }

  if (status === 429) {
    return "Zu viele Anfragen an Spotify. Bitte kurz warten.";
  }

  if (status >= 500) {
    return "Spotify hat gerade technische Probleme. Bitte gleich noch einmal versuchen.";
  }

  return `Spotify-Fehler (HTTP ${status}).`;
}

async function throwPlaybackError(response: Response): Promise<never> {
  const detail = await readSpotifyErrorDetail(response);

  console.error("Spotify API Fehler:", response.status, detail);

  throw new SpotifyApiError(
    response.status,
    describePlaybackError(response.status, detail),
  );
}

/**
 * Überträgt die Wiedergabe auf das angegebene Gerät,
 * ohne sofort abzuspielen.
 */
export async function transferPlayback(deviceId: string): Promise<void> {
  const response = await spotifyFetch("/me/player", "PUT", {
    device_ids: [deviceId],
    play: false,
  });

  if (!response.ok) {
    await throwPlaybackError(response);
  }
}

/**
 * Spielt einen Track von Anfang an auf dem angegebenen Gerät ab.
 *
 * Kennt Spotify das Gerät noch nicht (HTTP 404), was direkt nach
 * dem Start des Players vorkommen kann, wird die Wiedergabe
 * zuerst auf das Gerät übertragen und einmal neu versucht.
 */
export async function playTrackOnDevice(
  deviceId: string,
  trackUri: SpotifyTrackUri,
): Promise<void> {
  const play = () =>
    spotifyFetch(
      `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      "PUT",
      {
        uris: [trackUri],
        position_ms: 0,
      },
    );

  let response = await play();

  if (response.status === 404) {
    await transferPlayback(deviceId);

    await wait(500);

    response = await play();
  }

  if (!response.ok) {
    await throwPlaybackError(response);
  }
}

/**
 * Löst einen Spotify-Kurzlink (spotify.link/…) über das
 * eigene Backend in eine Track-URI auf.
 */
export async function resolveShortLink(shortUrl: string): Promise<SpotifyTrackUri> {
  const response = await fetch(
    `/api/spotify/resolve?url=${encodeURIComponent(shortUrl)}`,
    { cache: "no-store" },
  );

  const data = (await response.json().catch(() => ({}))) as {
    trackId?: string;
    error?: string;
  };

  if (!response.ok || !data.trackId || !/^[A-Za-z0-9]{22}$/.test(data.trackId)) {
    throw new SpotifyApiError(
      response.ok ? 422 : response.status,
      data.error ?? "Der Spotify-Kurzlink konnte nicht geöffnet werden.",
    );
  }

  return `spotify:track:${data.trackId}`;
}