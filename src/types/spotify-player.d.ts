export {};

declare global {
  /**
   * Aliase auf die offiziellen Typen aus @types/spotify-web-playback-sdk.
   * window.Spotify und window.onSpotifyWebPlaybackSDKReady
   * sind dort bereits deklariert.
   */
  type SpotifyWebPlaybackPlayer = Spotify.Player;
  type SpotifyWebPlaybackState = Spotify.PlaybackState;
}