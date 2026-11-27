export {};

/**
 * Typdefinitionen für das Spotify Web Playback SDK.
 *
 * Das SDK wird zur Laufzeit von https://sdk.scdn.co/spotify-player.js
 * geladen und hängt sich an window.Spotify.
 *
 * Diese Datei ist die einzige Typquelle für das SDK.
 * Das Paket @types/spotify-web-playback-sdk darf deshalb
 * NICHT zusätzlich installiert sein, sonst entstehen
 * widersprüchliche Deklarationen.
 */
declare global {
  /**
   * Fehler-Ereignisse des Players.
   */
  type SpotifyPlayerErrorEvent =
    | "initialization_error"
    | "authentication_error"
    | "account_error"
    | "playback_error";

  /**
   * Geräte-Ereignisse des Players.
   */
  type SpotifyPlayerDeviceEvent = "ready" | "not_ready";

  /**
   * Daten bei "ready" und "not_ready".
   */
  interface SpotifyWebPlaybackInstance {
    device_id: string;
  }

  /**
   * Daten bei allen Fehler-Ereignissen.
   */
  interface SpotifyWebPlaybackError {
    message: string;
  }

  /**
   * Ein Track im Player-Zustand.
   */
  interface SpotifyWebPlaybackTrack {
    id: string | null;
    uri: string;
    name: string;
    duration_ms: number;
    artists: Array<{
      name: string;
      uri: string;
    }>;
    album: {
      name: string;
      uri: string;
      images: Array<{
        url: string;
      }>;
    };
  }

  /**
   * Aktueller Wiedergabezustand.
   */
  interface SpotifyWebPlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: SpotifyWebPlaybackTrack;
    };
  }

  /**
   * Optionen beim Erstellen eines Players.
   */
  interface SpotifyPlayerOptions {
    name: string;
    volume?: number;
    getOAuthToken: (callback: (token: string) => void) => void;
  }

  /**
   * Der Player selbst.
   */
  interface SpotifyWebPlaybackPlayer {
    connect(): Promise<boolean>;

    disconnect(): void;

    addListener(
      event: SpotifyPlayerDeviceEvent,
      callback: (data: SpotifyWebPlaybackInstance) => void,
    ): boolean;

    addListener(
      event: SpotifyPlayerErrorEvent,
      callback: (data: SpotifyWebPlaybackError) => void,
    ): boolean;

    addListener(
      event: "player_state_changed",
      callback: (state: SpotifyWebPlaybackState | null) => void,
    ): boolean;

    addListener(event: "autoplay_failed", callback: () => void): boolean;

    removeListener(event: string): boolean;

    togglePlay(): Promise<void>;

    pause(): Promise<void>;

    resume(): Promise<void>;

    seek(positionMs: number): Promise<void>;

    activateElement(): Promise<void>;

    setVolume(volume: number): Promise<void>;

    getCurrentState(): Promise<SpotifyWebPlaybackState | null>;
  }

  interface Window {
    Spotify?: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyWebPlaybackPlayer;
    };

    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}