import { randomBytes } from "crypto";

/**
 * Spotify OAuth-Konfiguration.
 *
 * Sämtliche Zugangsdaten bleiben serverseitig.
 */
export const SPOTIFY_CONFIG = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,

  authorizeUrl: "https://accounts.spotify.com/authorize",
  tokenUrl: "https://accounts.spotify.com/api/token",

  scopes: [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ],
};

/**
 * Prüft, ob die erforderlichen Umgebungsvariablen vorhanden sind.
 */
export function validateSpotifyConfig(): void {
  if (
    !SPOTIFY_CONFIG.clientId ||
    !SPOTIFY_CONFIG.clientSecret ||
    !SPOTIFY_CONFIG.redirectUri
  ) {
    throw new Error(
      "Spotify-Konfiguration unvollständig. Bitte .env.local überprüfen.",
    );
  }
}

/**
 * Erstellt einen kryptografisch sicheren Zufallswert.
 *
 * Wird für den OAuth-State verwendet.
 */
export function generateState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Erstellt den Authorization-Header für Spotify.
 */
export function getSpotifyAuthorizationHeader(): string {
  validateSpotifyConfig();

  const credentials = Buffer.from(
    `${SPOTIFY_CONFIG.clientId}:${SPOTIFY_CONFIG.clientSecret}`,
  ).toString("base64");

  return `Basic ${credentials}`;
}

/**
 * Erstellt eine URL für die Spotify-Anmeldung.
 */
export function createSpotifyAuthorizationUrl(
  state: string,
): string {
  validateSpotifyConfig();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CONFIG.clientId!,
    redirect_uri: SPOTIFY_CONFIG.redirectUri!,
    scope: SPOTIFY_CONFIG.scopes.join(" "),
    state,
  });

  return `${SPOTIFY_CONFIG.authorizeUrl}?${params.toString()}`;
}