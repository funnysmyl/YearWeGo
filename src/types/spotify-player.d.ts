export {};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume?: number;
        getOAuthToken: (callback: (token: string) => void) => void;
      }) => SpotifyWebPlaybackPlayer;
    };

    onSpotifyWebPlaybackSDKReady?: () => void;
  }

  interface SpotifyWebPlaybackPlayer {
    connect(): Promise<boolean>;

    disconnect(): void;

    addListener(
      event: string,
      callback: (data: any) => void,
    ): boolean;

    removeListener(event: string): boolean;

    togglePlay(): Promise<void>;

    pause(): Promise<void>;

    resume(): Promise<void>;

    activateElement(): Promise<void>;

    setVolume(volume: number): Promise<void>;

    getCurrentState(): Promise<SpotifyWebPlaybackState | null>;
  }

  interface SpotifyWebPlaybackState {
    paused: boolean;

    position: number;

    duration: number;

    track_window: {
      current_track: {
        id: string;
        name: string;
        uri: string;
        artists: Array<{
          name: string;
        }>;
      };
    };
  }
}