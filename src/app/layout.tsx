import type { Metadata, Viewport } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";

/**
 * Pixel-Schrift für den gesamten Retro-Look.
 * Der Subset "latin" enthält auch ä, ö, ü und ß.
 */
const pixelFont = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Metadaten der Anwendung.
 *
 * robots: Die App ist privat und soll nicht
 * von Suchmaschinen indexiert werden.
 */
export const metadata: Metadata = {
  title: "YearWeGo",
  description: "Privates Musikspiel mit eigenen Karten",
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    title: "YearWeGo",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

/**
 * Viewport-Einstellungen für Smartphones.
 *
 * themeColor entspricht dem oberen Himmel-Farbton,
 * viewportFit sorgt für korrekte Darstellung auf iPhones
 * mit Dynamic Island.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1a3d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${pixelFont.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}