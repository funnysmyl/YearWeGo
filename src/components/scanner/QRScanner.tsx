"use client";

import { Html5Qrcode } from "html5-qrcode";

import { useCallback, useEffect, useRef, useState } from "react";

type QRScannerProps = {
  onScan: (decodedText: string) => void;

  onError?: (error: string) => void;

  onClose?: () => void;
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

export default function QRScanner({ onScan, onError, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const scannerContainerRef = useRef<HTMLDivElement | null>(null);

  const onScanRef = useRef(onScan);

  const onErrorRef = useRef(onError);

  /**
   * Als Ref statt State, damit der Scan-Callback immer
   * den aktuellen Wert sieht und eine Karte nicht
   * mehrfach gemeldet wird.
   */
  const hasScannedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /**
   * Callback-Referenzen aktuell halten.
   */
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  /**
   * Fehler zentral behandeln.
   */
  const handleError = useCallback((message: string) => {
    setError(message);

    onErrorRef.current?.(message);
  }, []);

  /**
   * Scanner stoppen und Kamerazugriff freigeben.
   */
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      setIsScanning(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();

      scannerRef.current = null;

      setIsScanning(false);
    } catch (err) {
      console.error("QR-Scanner konnte nicht gestoppt werden:", err);

      handleError("Der Scanner konnte nicht vollständig beendet werden.");
    }
  }, [handleError]);

  /**
   * QR-Code-Scanner starten.
   */
  const startScanner = useCallback(async () => {
    if (isLoading || isScanning) {
      return;
    }

    setIsLoading(true);
    setError(null);

    hasScannedRef.current = false;

    try {
      if (!scannerContainerRef.current) {
        throw new Error("Scanner-Element wurde nicht gefunden.");
      }

      const scanner = new Html5Qrcode("yearwego-qr-reader");

      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
        aspectRatio: 1,
      };

      /**
       * "environment" wählt auf Smartphones
       * normalerweise die Rückkamera.
       */
      await scanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          if (hasScannedRef.current) {
            return;
          }

          hasScannedRef.current = true;

          await stopScanner();

          onScanRef.current(decodedText);
        },
        () => {
          /**
           * Fehlgeschlagene Einzelversuche beim Scannen
           * sind normal und werden ignoriert.
           */
        },
      );

      setIsScanning(true);
    } catch (err) {
      console.error("QR-Scanner Fehler:", err);

      handleError(getCameraErrorMessage(err));

      await stopScanner();
    } finally {
      setIsLoading(false);
    }
  }, [handleError, isLoading, isScanning, stopScanner]);

  /**
   * Scanner beim Verlassen der Komponente aufräumen.
   */
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        void scanner.stop().catch((err) => {
          console.error("Scanner Cleanup Fehler:", err);
        });
      }
    };
  }, []);

  /**
   * Scanner schließen.
   */
  const handleClose = async () => {
    await stopScanner();

    onClose?.();
  };

  return (
    <div className="px-panel p-6">
      <div className="mb-5 text-center">
        <h2 className="px-heading text-xl">Karte scannen</h2>

        <p className="mt-2 text-sm text-mist">
          Halte die Kamera auf den QR-Code deiner Karte.
        </p>
      </div>

      <div
        ref={scannerContainerRef}
        id="yearwego-qr-reader"
        className="px-slot min-h-[280px] w-full overflow-hidden bg-black"
      />

      {error && (
        <div role="alert" className="px-alert mt-5 p-4 text-sm">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col gap-5">
        {!isScanning ? (
          <button
            onClick={startScanner}
            disabled={isLoading}
            className="px-btn px-btn-grass"
          >
            {isLoading ? "Kamera startet …" : "Kamera starten"}
          </button>
        ) : (
          <button onClick={stopScanner} className="px-btn px-btn-stone">
            Scannen abbrechen
          </button>
        )}

        <button onClick={handleClose} className="px-btn px-btn-wood px-btn-small">
          Schließen
        </button>
      </div>
    </div>
  );
}