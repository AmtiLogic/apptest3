import type { NextConfig } from "next";

/**
 * Three build targets share this config.
 *
 * - Default: the app as Vercel (or `next start`) expects it. Nothing special.
 * - BUILD_STANDALONE=1: a self-contained server bundle, used by the Dockerfile.
 *   Vercel does its own bundling, so this stays off there.
 * - STATIC_EXPORT=1: a static bundle for GitHub Pages. Pages has no server, so
 *   `scripts/build-static.mjs` strips the API routes and middleware first and
 *   the client falls back to sample data.
 */
// A blank value counts as unset: hosts that pre-fill names from .env.example
// leave empty strings, which `??` would not fall back on.
const basePath = process.env.PAGES_BASE_PATH?.trim() || "/apptest3";

const isStatic = process.env.STATIC_EXPORT === "1";
const isStandalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export" as const,
        // GitHub Pages serves a project site under /<repo>.
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : isStandalone
      ? { output: "standalone" as const }
      : {}),
};

export default nextConfig;
