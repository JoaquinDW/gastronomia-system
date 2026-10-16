import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite probar app.localhost y <tienda>.localhost en desarrollo.
  allowedDevOrigins: ["*.localhost"],
};

export default nextConfig;
