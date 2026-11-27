"use client";

import { Html5Qrcode } from "html5-qrcode";

import { useCallback, useEffect, useRef, useState } from "react";

type QRScannerProps = {
  /**
   * Wird bei jedem erkannten QR-Code aufgerufen.
   *
   * true  = Code angenommen, der Scanner wird geschlossen.
   * false = Code abgelehnt, der Scanner sucht weiter und
   *         ignoriert diesen Code ab jetzt.
   */
  onScan: (decodedText: string) => boolean;

  onError?: (error: string) => void;

  onClose?: () => void;
};

type ScannerStatus = "starting" | "scanning" | "error";

const SCANNER_ELEMENT_ID = "yearwego-qr-reader";

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: {
    width: 250,
    height: 250,
  },
  aspectRatio: 1,
};

/**
 * Übersetzt technische Kamera-Fehler in verständliche Meldungen.
 *
 * html5-qrcode liefert teils Error-Objekte, teils Strings.
 */
function getCameraErrorMessage(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name} ${err.message}` : String(err);

  if (/NotAllowed|Permission/i.test(text)) {
    return "Kamerazugriff wurde verweigert. Erlaube die Kamera in den Einstellungen (iPhone: Einstellungen → Apps → Safari → Kamera) und lade die Seite neu.";
  }

  if (/NotFound|device not found/i.test(text)) {
    return "Es wurde keine Kamera gefunden.";
  }

  if (/NotReadable|Could not start video/i.test(text)) {
    return "Die Kamera wird gerade von einer anderen App verwendet.";
  }

  if (/secure|https/i.test(text)) {
    return "Die Kamera funktioniert nur über eine sichere HTTPS-Verbindung.";
  }

  return "Die Kamera konnte nicht gestartet werden.";
}

/**
 * QR-Code-Scanner, der die Kamera beim Erscheinen
 * automatisch startet und beim Verschwinden stoppt.
 */
export default function QRScanner({ onScan, onError, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const onScanRef = useRef(onScan);

  const onErrorRef = useRef(onError);

  /**
   * Verhindert, dass eine angenommene Karte mehrfach gemeldet wird,
   * weil der Scanner bis zu 10 Bilder pro Sekunde prüft.
   */
  const hasScannedRef = useRef(false);

  /**
   * Bereits abgelehnte Codes. Sie werden nicht erneut gemeldet,
   * damit die Fehlermeldung nicht ständig neu erscheint.
   */
  const rejectedCodesRef = useRef<Set<string>>(new Set());

  /**
   * Warteschlange für Kamera-Operationen.
   *
   * Starten und Stoppen laufen strikt nacheinander ab.
   * Ohne diese Warteschlange könnte die Kamera doppelt
   * geöffnet werden (z. B. durch den React Strict Mode
   * in der Entwicklung oder schnelles Tippen).
   */
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const [status, setStatus] = useState<ScannerStatus>("starting");

  const [error, setError] = useState<string | null>(null);

  /**
   * Callback-Referenzen aktuell halten.
   */
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  /**
   * Hängt eine Aufgabe an die Warteschlange an.
   */
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const next = queueRef.current.then(task).catch((err: unknown) => {
      console.error("QR-Scanner:", err);
    });

    queueRef.current = next;

    return next;
  }, []);

  /**
   * Kamera stoppen und Anzeige leeren.
   */
  const stopCamera = useCallback(async (): Promise<void> => {
    const scanner = scannerRef.current;

    scannerRef.current = null;

    if (!scanner) {
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (err) {
      console.error("QR-Scanner konnte nicht gestoppt werden:", err);
    }
  }, []);

  /**
   * Kamera starten und auf QR-Codes warten.
   */
  const startCamera = useCallback(async (): Promise<void> => {
    setStatus("starting");
    setError(null);

    hasScannedRef.current = false;
    rejectedCodesRef.current.clear();

    let scanner: Html5Qrcode | null = null;

    try {
      scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);

      scannerRef.current = scanner;

      /**
       * "environment" wählt auf Smartphones
       * normalerweise die Rückkamera.
       */
      await scanner.start(
        { facingMode: "environment" },
        SCANNER_CONFIG,
        (decodedText) => {
          if (
            hasScannedRef.current ||
            rejectedCodesRef.current.has(decodedText)
          ) {
            return;
          }

          const accepted = onScanRef.current(decodedText);

          if (accepted) {
            hasScannedRef.current = true;

            void enqueue(stopCamera);
          } else {
            rejectedCodesRef.current.add(decodedText);
          }
        },
        () => {
          /**
           * Fehlgeschlagene Einzelversuche beim Scannen
           * sind normal und werden ignoriert.
           */
        },
      );

      setStatus("scanning");
    } catch (err) {
      console.error("QR-Scanner Fehler:", err);

      scannerRef.current = null;

      try {
        scanner?.clear();
      } catch {
        // Nichts zu bereinigen.
      }

      const message = getCameraErrorMessage(err);

      setError(message);
      setStatus("error");

      onErrorRef.current?.(message);
    }
  }, [enqueue, stopCamera]);

  /**
   * Kamera beim Erscheinen automatisch starten
   * und beim Verschwinden wieder freigeben.
   *
   * "cancelled" sorgt dafür, dass ein Start übersprungen wird,
   * wenn die Komponente schon wieder entfernt wurde, bevor
   * die Warteschlange ihn ausführen konnte.
   */
  useEffect(() => {
    let cancelled = false;

    void enqueue(async () => {
      if (!cancelled) {
        await startCamera();
      }
    });

    return () => {
      cancelled = true;

      void enqueue(stopCamera);
    };
  }, [enqueue, startCamera, stopCamera]);

  /**
   * Nach einem Fehler erneut versuchen.
   */
  const handleRetry = () => {
    void enqueue(async () => {
      await stopCamera();
      await startCamera();
    });
  };

  return (
    <div className="px-panel p-6">
      <div className="mb-5 text-center">
        <h2 className="px-heading text-xl">Karte scannen</h2>

        <p className="mt-2 text-sm text-mist">
          Halte die Kamera auf den QR-Code deiner Karte.
        </p>
      </div>

      <div className="relative">
        {/*
          In dieses Element fügt html5-qrcode das Kamerabild ein.
          Es darf deshalb keine React-Kindelemente enthalten.
        */}
        <div
          id={SCANNER_ELEMENT_ID}
          className="px-slot min-h-[280px] w-full overflow-hidden bg-black"
        />

        {status === "starting" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="px-heading text-mist">Kamera startet …</p>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="px-alert mt-5 p-4 text-sm">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col gap-5">
        {status === "error" && (
          <button onClick={handleRetry} className="px-btn px-btn-grass">
            Erneut versuchen
          </button>
        )}

        <button
          onClick={() => onClose?.()}
          className="px-btn px-btn-wood px-btn-small"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}