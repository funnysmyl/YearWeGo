"use client";

import { Html5Qrcode } from "html5-qrcode";

import { useCallback, useEffect, useRef, useState } from "react";

type QRScannerProps = {
  onScan: (decodedText: string) => void;

  onError?: (error: string) => void;

  onClose?: () => void;
};

export default function QRScanner({
  onScan,
  onError,
  onClose,
}: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const scannerContainerRef = useRef<HTMLDivElement | null>(null);

  const onScanRef = useRef(onScan);

  const onErrorRef = useRef(onError);

  const [isScanning, setIsScanning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [hasScanned, setHasScanned] = useState(false);

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

      handleError(
        "Der QR-Code-Scanner konnte nicht vollständig beendet werden.",
      );
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
    setHasScanned(false);

    try {
      if (!scannerContainerRef.current) {
        throw new Error("Scanner-Element wurde nicht gefunden.");
      }

      const scanner = new Html5Qrcode("hitster-qr-reader");

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
       * Rückkamera bevorzugen.
       *
       * "environment" wählt auf Smartphones normalerweise
       * die rückseitige Kamera.
       */
      await scanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          if (hasScanned) {
            return;
          }

          setHasScanned(true);

          /**
           * Scanner sofort stoppen.
           */
          await stopScanner();

          /**
           * Erkannte QR-Code-Daten weitergeben.
           */
          onScanRef.current(decodedText);
        },
        () => {
          /**
           * Fehlgeschlagene Einzelversuche beim Scannen
           * sind normal und werden deshalb ignoriert.
           */
        },
      );

      setIsScanning(true);
    } catch (err) {
      console.error("QR-Scanner Fehler:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Kamera konnte nicht gestartet werden.";

      handleError(message);

      await stopScanner();
    } finally {
      setIsLoading(false);
    }
  }, [hasScanned, handleError, isLoading, isScanning, stopScanner]);

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
    <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-white">
          Karte scannen
        </h2>

        <p className="mt-2 text-sm text-gray-400">
          Richte deine Kamera auf den QR-Code deiner Hitster-Karte.
        </p>
      </div>

      <div
        ref={scannerContainerRef}
        id="hitster-qr-reader"
        className="min-h-[280px] w-full overflow-hidden rounded-xl bg-black"
      />

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {!isScanning ? (
          <button
            onClick={startScanner}
            disabled={isLoading}
            className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Kamera wird gestartet ..." : "Kamera starten"}
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="w-full rounded-lg border border-gray-600 px-4 py-3 font-medium text-white transition hover:bg-gray-800"
          >
            Scannen abbrechen
          </button>
        )}

        <button
          onClick={handleClose}
          className="w-full rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}