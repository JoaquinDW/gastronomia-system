import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite probar app. y <tienda>. en desarrollo (localhost o lvh.me).
  allowedDevOrigins: ["*.localhost", "*.lvh.me"],
};

export default nextConfig;
