import type { Song } from "./song";

/**
 * Definiert die möglichen Zustände einer Spielrunde.
 */
export type GameStatus =
  | "idle"
  | "scanning"
  | "ready"
  | "playing"
  | "paused"
  | "revealed"
  | "error";

/**
 * Repräsentiert den Zustand einer einzelnen Spielrunde.
 *
 * Die Songinformationen bleiben während der Wiedergabe
 * intern verfügbar, werden aber erst nach der Auflösung
 * in der Benutzeroberfläche angezeigt.
 */
export type GameState = {
  /**
   * Aktueller Zustand der Spielrunde.
   */
  status: GameStatus;

  /**
   * Song der aktuellen Spielrunde.
   *
   * Ist null, wenn noch keine Karte gescannt wurde.
   */
  currentSong: Song | null;

  /**
   * Fehlermeldung für den aktuellen Spielzustand.
   *
   * Ist null, wenn kein Fehler vorliegt.
   */
  errorMessage: string | null;
};