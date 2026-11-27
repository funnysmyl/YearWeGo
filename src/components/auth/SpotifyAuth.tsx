"use client";

import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";

export default function SpotifyAuth() {
  const {
    status,
    isAuthenticated,
    isLoading,
    error,
    logout,
  } = useSpotifyAuth();

  /**
   * Anmeldung über die bestehende Spotify-Login-Route.
   */
  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  /**
   * Spotify-Abmeldung.
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Der Fehler wird bereits im Hook gespeichert.
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
        <p className="text-gray-300">
          Spotify-Verbindung wird überprüft ...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white">
          Spotify verbinden
        </h2>

        <p className="mt-2 text-sm text-gray-400">
          Verbinde dein Spotify-Konto, um deine Songs direkt
          in Hitster DIY abzuspielen.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-green-800 bg-green-950/40 p-4">
            <div className="flex items-center justify-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />

              <span className="font-medium text-green-400">
                Spotify verbunden
              </span>
            </div>

            <p className="mt-2 text-center text-sm text-gray-400">
              Dein Spotify-Konto ist erfolgreich verbunden.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Von Spotify abmelden
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <p className="text-center text-sm text-gray-300">
              Du bist aktuell nicht mit Spotify verbunden.
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400"
          >
            Mit Spotify anmelden
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <div className="mt-6 border-t border-gray-700 pt-4">
        <p className="text-center text-xs text-gray-500">
          Authentifizierungsstatus: {status}
        </p>
      </div>
    </div>
  );
}