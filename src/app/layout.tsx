import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadaten der Anwendung.
 *
 * robots: Die App ist privat und soll nicht
 * von Suchmaschinen indexiert werden.
 */
export const metadata: Metadata = {
  title: "Hitster DIY",
  description: "Privates Musikspiel mit eigenen Karten",
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    title: "Hitster DIY",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

/**
 * Viewport-Einstellungen für Smartphones.
 *
 * themeColor entspricht dem dunklen Hintergrund der App,
 * viewportFit sorgt für korrekte Darstellung auf iPhones
 * mit Notch bzw. Dynamic Island.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030712",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}