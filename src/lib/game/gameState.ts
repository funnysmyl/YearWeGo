import type { GameAction, GameState } from "@/types/game";

/**
 * Startzustand des Spiels.
 */
export const initialGameState: GameState = {
  mode: "simple",
  phase: "idle",
  card: null,
  round: 0,
  errorMessage: null,
};

/**
 * Steuert den Spielablauf.
 *
 * Aktuell gibt es nur den einfachen Modus. Spätere Spielmodi
 * können eigene Aktionen ergänzen, ohne Scanner oder Player
 * zu verändern.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_SCAN":
      return {
        ...state,
        phase: "scanning",
        card: null,
        errorMessage: null,
      };

    case "CANCEL_SCAN":
      if (state.phase !== "scanning" && state.phase !== "resolving") {
        return state;
      }

      return {
        ...state,
        phase: "idle",
        errorMessage: null,
      };

    case "RESOLVE_STARTED":
      if (state.phase !== "scanning") {
        return state;
      }

      return {
        ...state,
        phase: "resolving",
        errorMessage: null,
      };

    case "RESOLVE_FAILED":
      if (state.phase !== "resolving") {
        return state;
      }

      return {
        ...state,
        phase: "scanning",
        errorMessage: action.message,
      };

    case "CARD_SCANNED":
      /**
       * Nur aus dem Scan- oder Auflöse-Zustand heraus.
       * Verhindert, dass ein verspätet aufgelöster Kurzlink
       * nach "Abbrechen" doch noch eine Runde startet.
       */
      if (state.phase !== "scanning" && state.phase !== "resolving") {
        return state;
      }

      return {
        ...state,
        phase: "round",
        card: action.card,
        round: state.round + 1,
        errorMessage: null,
      };

    case "SCAN_REJECTED":
      if (state.phase !== "scanning") {
        return state;
      }

      return {
        ...state,
        errorMessage: action.message,
      };

    case "NEXT_CARD":
      return {
        ...state,
        phase: "scanning",
        card: null,
        errorMessage: null,
      };

    case "RESET":
      return initialGameState;

    default:
      return state;
  }
}