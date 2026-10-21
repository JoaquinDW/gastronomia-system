import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite probar app. y <tienda>. en desarrollo (localhost o lvh.me).
  allowedDevOrigins: ["*.localhost", "*.lvh.me"],
  // PostHog por el mismo dominio, así los bloqueadores no lo cortan.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
