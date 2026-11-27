"use client";

import type { UseSpotifyAuthReturn } from "@/hooks/useSpotifyAuth";

type SpotifyAuthProps = {
  /**
   * Gemeinsamer Auth-Zustand aus page.tsx.
   * Die Komponente ruft den Hook bewusst nicht selbst auf,
   * damit es nur einen Anmeldestatus gibt.
   */
  auth: UseSpotifyAuthReturn;
};

export default function SpotifyAuth({ auth }: SpotifyAuthProps) {
  const { isAuthenticated, isLoading, error, logout } = auth;

  /**
   * Anmeldung über die Spotify-Login-Route.
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
      <div className="px-panel p-6 text-center">
        <p className="text-mist">Spotify-Verbindung wird geprüft …</p>
      </div>
    );
  }

  return (
    <div className="px-panel p-7">
      <div className="mb-6 text-center">
        <h2 className="px-heading text-2xl">Spotify</h2>

        <p className="mt-2 text-sm text-mist">
          Verbinde dein Spotify-Konto, damit die Songs direkt hier abgespielt
          werden.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="space-y-6">
          <div className="px-success flex items-center justify-center gap-3 p-4">
            <span
              className="px-dot"
              style={{ backgroundColor: "#4fae3a" }}
              aria-hidden="true"
            />

            <span className="font-semibold">Spotify verbunden</span>
          </div>

          <button
            onClick={handleLogout}
            className="px-btn px-btn-life px-btn-small"
          >
            Abmelden
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="px-slot p-4">
            <p className="text-center text-sm text-mist">
              Du bist noch nicht mit Spotify verbunden.
            </p>
          </div>

          <button onClick={handleLogin} className="px-btn px-btn-grass">
            Mit Spotify anmelden
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="px-alert mt-6 p-4 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}