import songsData from "@/data/songs.json";

import type { Song, SongDatabase, SpotifyTrackUri } from "@/types/song";

/**
 * Lokale Songliste aus src/data/songs.json.
 */
const SONGS: SongDatabase = songsData as SongDatabase;

/**
 * Nachschlagetabellen für schnellen Zugriff.
 */
const songsByCardId = new Map<string, Song>(
  SONGS.map((song) => [song.qrCodeId.trim(), song]),
);

const songsByTrackUri = new Map<SpotifyTrackUri, Song>(
  SONGS.map((song) => [song.spotifyTrackUri, song]),
);

/**
 * Sucht einen Song anhand der Kartennummer.
 */
export function findSongByCardId(cardId: string): Song | null {
  return songsByCardId.get(cardId.trim()) ?? null;
}

/**
 * Sucht einen Song anhand der Spotify-URI.
 *
 * Wird genutzt, wenn ein QR-Code direkt einen Spotify-Link enthält.
 */
export function findSongByTrackUri(trackUri: SpotifyTrackUri): Song | null {
  return songsByTrackUri.get(trackUri) ?? null;
}

/**
 * Anzahl der Songs in der Liste.
 */
export function getSongCount(): number {
  return SONGS.length;
}