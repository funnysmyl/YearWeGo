/**
 * Repräsentiert einen Song innerhalb der Hitster-App.
 *
 * Die qrCodeId identifiziert die physische Spielkarte.
 * Die spotifyTrackUri identifiziert den zugehörigen Spotify-Track.
 *
 * Titel, Interpret und Erscheinungsjahr werden erst nach
 * der Auflösung einer Karte angezeigt.
 */
export type Song = {
  /**
   * Eindeutige ID der physischen Spielkarte.
   *
   * Diese ID wird im QR-Code gespeichert.
   *
   * Beispiel: "001"
   */
  qrCodeId: string;

  /**
   * Spotify-URI des Songs.
   *
   * Format: spotify:track:<Spotify-Track-ID>
   */
  spotifyTrackUri: `spotify:track:${string}`;

  /**
   * Titel des Songs.
   *
   * Wird erst nach der Auflösung angezeigt.
   */
  title: string;

  /**
   * Interpret des Songs.
   *
   * Wird erst nach der Auflösung angezeigt.
   */
  artist: string;

  /**
   * Erscheinungsjahr des Songs.
   *
   * Wird erst nach der Auflösung angezeigt.
   */
  year: number;
};

/**
 * Repräsentiert die vollständige lokale Songdatenbank.
 */
export type SongDatabase = Song[];