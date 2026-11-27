import type { SpotifyTrackUri } from "./song";

/**
 * Spielmodus.
 *
 * simple – Einfacher Scanner: Karte scannen, Song läuft im Hintergrund.
 *          Songinfos stehen auf der Rückseite der physischen Karte,
 *          die App zeigt keine an.
 *
 * Spätere Modi (z. B. mit digitaler Auflösung über songs.json)
 * werden hier ergänzt.
 */
export type GameMode = "simple";

/**
 * Phase des Spielablaufs.
 *
 * idle      – Startzustand, Button "Karte scannen" sichtbar
 * scanning  – Kamera ist offen
 * resolving – Ein Spotify-Kurzlink wird aufgelöst
 * round     – Eine Karte wurde erkannt, der Song läuft
 */
export type GamePhase = "idle" | "scanning" | "resolving" | "round";

/**
 * Die aktuell gescannte Karte.
 *
 * Enthält bewusst keine Songinfos (Titel, Interpret, Jahr),
 * damit die App im einfachen Modus nichts verraten kann.
 */
export type CurrentCard = {
  /**
   * Abzuspielender Spotify-Track.
   */
  spotifyTrackUri: SpotifyTrackUri;

  /**
   * Kartennummer, falls der QR-Code eine eigene Karten-ID
   * (z. B. hitster://song/001) enthielt. Sonst null.
   */
  cardId: string | null;
};

/**
 * Zustand des Spiels.
 */
export type GameState = {
  mode: GameMode;

  phase: GamePhase;

  card: CurrentCard | null;

  /**
   * Zähler, der sich mit jeder neuen Karte erhöht.
   * Sorgt dafür, dass die Spieloberfläche pro Karte frisch startet.
   */
  round: number;

  /**
   * Fehlermeldung beim Scannen, z. B. bei ungültigem QR-Code.
   */
  errorMessage: string | null;
};

/**
 * Alle möglichen Aktionen im Spielablauf.
 */
export type GameAction =
  | { type: "START_SCAN" }
  | { type: "CANCEL_SCAN" }
  | { type: "RESOLVE_STARTED" }
  | { type: "RESOLVE_FAILED"; message: string }
  | { type: "CARD_SCANNED"; card: CurrentCard }
  | { type: "SCAN_REJECTED"; message: string }
  | { type: "NEXT_CARD" }
  | { type: "RESET" };