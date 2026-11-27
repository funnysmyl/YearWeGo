import type { NextConfig } from "next";

/**
 * Optionaler Hostname eines HTTPS-Tunnels (z. B. ngrok)
 * für Tests auf dem Smartphone während `npm run dev`.
 *
 * Beispiel in .env.local:
 * DEV_TUNNEL_HOST=mein-name.ngrok-free.app
 */
const devTunnelHost = process.env.DEV_TUNNEL_HOST;

const nextConfig: NextConfig = {
  allowedDevOrigins: devTunnelHost ? [devTunnelHost] : [],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;