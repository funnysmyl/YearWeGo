import { randomBytes } from "crypto";

/**
 * Spotify OAuth-Konfiguration.
 *
 * Sämtliche Zugangsdaten bleiben serverseitig.
 * trim() entfernt versehentlich mitkopierte Leerzeichen
 * aus den Umgebungsvariablen (z. B. im Vercel-Dashboard).
 */
export const SPOTIFY_CONFIG = {
  clientId: process.env.SPOTIFY_CLIENT_ID?.trim(),
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim(),
  redirectUri: process.env.SPOTIFY_REDIRECT_URI?.trim(),

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
 * Fehler für eine unvollständige Spotify-Konfiguration.
 *
 * Enthält die Namen der fehlenden Umgebungsvariablen,
 * niemals deren Werte.
 */
export class SpotifyConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Spotify-Konfiguration unvollständig. Fehlende Umgebungsvariablen: ${missing.join(", ")}`,
    );

    this.name = "SpotifyConfigError";
    this.missing = missing;
  }
}

/**
 * Gibt die Namen aller fehlenden Umgebungsvariablen zurück.
 *
 * Eine leere Liste bedeutet: Konfiguration vollständig.
 */
export function getMissingSpotifyConfig(): string[] {
  const missing: string[] = [];

  if (!SPOTIFY_CONFIG.clientId) {
    missing.push("SPOTIFY_CLIENT_ID");
  }

  if (!SPOTIFY_CONFIG.clientSecret) {
    missing.push("SPOTIFY_CLIENT_SECRET");
  }

  if (!SPOTIFY_CONFIG.redirectUri) {
    missing.push("SPOTIFY_REDIRECT_URI");
  }

  return missing;
}

/**
 * Prüft, ob die erforderlichen Umgebungsvariablen vorhanden sind.
 *
 * Wirft einen SpotifyConfigError, falls etwas fehlt.
 */
export function validateSpotifyConfig(): void {
  const missing = getMissingSpotifyConfig();

  if (missing.length > 0) {
    throw new SpotifyConfigError(missing);
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
export function createSpotifyAuthorizationUrl(state: string): string {
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