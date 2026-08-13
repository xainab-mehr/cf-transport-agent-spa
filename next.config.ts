import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows the dev server to be previewed through a proxied domain.
  // Safe to remove for local-only development.
  allowedDevOrigins: [
    "*.manus.computer",
    "3000-izgkmbobsso1j4ec1q8cw-1293863b.us2.manus.computer",
  ],
};

export default nextConfig;
