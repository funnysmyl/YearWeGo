import type { SpotifyTrackUri } from "@/types/song";

/**
 * Ergebnis der Auswertung eines QR-Codes.
 *
 * card      – eigene Karten-ID, Song kommt aus songs.json
 * spotify   – direkter Spotify-Track
 * shortlink – Spotify-Kurzlink, muss erst aufgelöst werden
 * invalid   – kein abspielbarer Song
 */
export type ParsedQRCode =
  | { kind: "card"; cardId: string }
  | { kind: "spotify"; spotifyTrackUri: SpotifyTrackUri }
  | { kind: "shortlink"; url: string }
  | { kind: "invalid"; reason: string };

/**
 * Erlaubte Zeichen für Kartennummern, z. B. "001" oder "rock-12".
 */
const CARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Spotify-Track-IDs bestehen immer aus 22 Zeichen (Base62).
 */
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

/**
 * Track-Pfad auf spotify.com, z. B.:
 * /track/<ID>, /intl-de/track/<ID>, /embed/track/<ID>
 */
const TRACK_PATH_PATTERN =
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})(?![A-Za-z0-9])/i;

/**
 * Andere Spotify-Inhalte, die kein einzelner Song sind.
 */
const OTHER_CONTENT_PATTERN =
  /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(album|playlist|artist|episode|show|audiobook|chapter|user|genre)\//i;

const OTHER_CONTENT_NAMES: Record<string, string> = {
  album: "einem Album",
  playlist: "einer Playlist",
  artist: "einem Künstlerprofil",
  episode: "einer Podcast-Folge",
  show: "einem Podcast",
  audiobook: "einem Hörbuch",
  chapter: "einem Hörbuch-Kapitel",
  user: "einem Nutzerprofil",
  genre: "einer Genre-Seite",
};

const NOT_PLAYABLE_MESSAGE =
  "Dieser QR-Code enthält keinen Link zu einem Spotify-Song.";

function invalid(reason: string): ParsedQRCode {
  return { kind: "invalid", reason };
}

function spotifyTrack(trackId: string): ParsedQRCode {
  return {
    kind: "spotify",
    spotifyTrackUri: `spotify:track:${trackId}`,
  };
}

function otherContent(type: string): ParsedQRCode {
  const name = OTHER_CONTENT_NAMES[type.toLowerCase()] ?? "keinem einzelnen Song";

  return invalid(`Dieser Link führt zu ${name}, nicht zu einem einzelnen Song.`);
}

/**
 * Prüft eine Kartennummer und liefert das passende Ergebnis.
 */
function card(rawCardId: string): ParsedQRCode {
  let cardId: string;

  try {
    cardId = decodeURIComponent(rawCardId).trim();
  } catch {
    return invalid("Die Kartennummer im QR-Code ist beschädigt.");
  }

  if (!CARD_ID_PATTERN.test(cardId)) {
    return invalid("Die Kartennummer im QR-Code ist ungültig.");
  }

  return { kind: "card", cardId };
}

/**
 * Holt den relevanten Teil aus dem QR-Text.
 *
 * Enthält der QR-Code einen ganzen Satz (z. B. "Hör mal: https://…"),
 * wird der erste enthaltene Link verwendet.
 */
function extractCandidate(rawText: string): string {
  const trimmed = rawText.trim();

  if (!/\s/.test(trimmed)) {
    return trimmed;
  }

  const embedded = trimmed.match(
    /(?:https?:\/\/|(?:hitster|yearwego):\/\/|spotify:|(?:open\.|play\.)?spotify\.(?:com|link)\/|spotify\.app\.link\/)\S+/i,
  );

  return embedded ? embedded[0] : trimmed;
}

/**
 * Ergänzt "https://" bei Links ohne Protokoll,
 * z. B. "open.spotify.com/track/…".
 */
function addMissingProtocol(text: string): string {
  if (/^(?:(?:open\.|play\.|www\.)?spotify\.(?:com|link)|spotify\.app\.link)\//i.test(text)) {
    return `https://${text}`;
  }

  return text;
}

/**
 * Wertet Spotify-URIs aus (spotify:track:… oder spotify://track/…).
 */
function parseSpotifyUri(text: string): ParsedQRCode | null {
  const uriMatch = text.match(/^spotify:track:([A-Za-z0-9]{22})(?![A-Za-z0-9])/i);

  if (uriMatch) {
    return spotifyTrack(uriMatch[1]);
  }

  const deepLinkMatch = text.match(/^spotify:\/\/\/?track\/([A-Za-z0-9]{22})(?![A-Za-z0-9])/i);

  if (deepLinkMatch) {
    return spotifyTrack(deepLinkMatch[1]);
  }

  const otherUriMatch = text.match(
    /^spotify:(?:\/\/\/?)?(album|playlist|artist|episode|show|audiobook|chapter|user)[:/]/i,
  );

  if (otherUriMatch) {
    return otherContent(otherUriMatch[1]);
  }

  return null;
}

/**
 * Wertet Web-Links aus.
 */
function parseUrl(url: URL): ParsedQRCode {
  const host = url.hostname.toLowerCase();

  /**
   * Spotify-Kurzlinks (Teilen-Funktion der Spotify-App).
   */
  if (host === "spotify.link" || host.endsWith(".spotify.link") || host === "spotify.app.link") {
    url.protocol = "https:";

    return { kind: "shortlink", url: url.toString() };
  }

  /**
   * Normale Spotify-Links.
   */
  if (host === "spotify.com" || host.endsWith(".spotify.com")) {
    const trackMatch = url.pathname.match(TRACK_PATH_PATTERN);

    if (trackMatch) {
      return spotifyTrack(trackMatch[1]);
    }

    /**
     * Album-Link mit hervorgehobenem Song:
     * …/album/<ID>?highlight=spotify:track:<ID>
     */
    const highlight = url.searchParams.get("highlight");

    if (highlight) {
      const highlightMatch = highlight.match(/^spotify:track:([A-Za-z0-9]{22})$/);

      if (highlightMatch) {
        return spotifyTrack(highlightMatch[1]);
      }
    }

    const otherMatch = url.pathname.match(OTHER_CONTENT_PATTERN);

    if (otherMatch) {
      return otherContent(otherMatch[1]);
    }

    return invalid("Dieser Spotify-Link führt nicht zu einem einzelnen Song.");
  }

  /**
   * Eigene Web-Links, z. B. https://year-we-go.vercel.app/k/001
   */
  const ownLinkMatch = url.pathname.match(/^\/(?:k|song|card)\/([^/]+)\/?$/i);

  if (ownLinkMatch) {
    return card(ownLinkMatch[1]);
  }

  return invalid(NOT_PLAYABLE_MESSAGE);
}

/**
 * Wertet den Text eines gescannten QR-Codes aus.
 */
export function parseQRCode(rawText: string): ParsedQRCode {
  const text = addMissingProtocol(extractCandidate(rawText));

  if (!text) {
    return invalid("Der QR-Code ist leer.");
  }

  /**
   * 1. Eigene Karte mit App-Schema: hitster://song/001, yearwego://song/001
   */
  const schemeMatch = text.match(/^(?:hitster|yearwego):\/\/song\/([^/?#]+)\/?$/i);

  if (schemeMatch) {
    return card(schemeMatch[1]);
  }

  /**
   * 2. Spotify-URIs.
   */
  const uriResult = parseSpotifyUri(text);

  if (uriResult) {
    return uriResult;
  }

  /**
   * 3. Web-Links.
   */
  let url: URL | null = null;

  try {
    url = new URL(text);
  } catch {
    url = null;
  }

  if (url && (url.protocol === "https:" || url.protocol === "http:")) {
    return parseUrl(url);
  }

  /**
   * 4. Nackte Spotify-Track-ID.
   */
  if (SPOTIFY_ID_PATTERN.test(text)) {
    return spotifyTrack(text);
  }

  return invalid(NOT_PLAYABLE_MESSAGE);
}