import type { NextConfig } from "next";

/**
 * Two build targets share this config.
 *
 * - Default: the full app with API routes and middleware, for a host that runs
 *   Node (Vercel, Docker, a machine at home).
 * - STATIC_EXPORT=1: a static bundle for GitHub Pages. Pages has no server, so
 *   `scripts/build-static.mjs` strips the API routes and middleware first and
 *   the client falls back to sample data.
 */
const isStatic = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export" as const,
        // GitHub Pages serves a project site under /<repo>.
        basePath: process.env.PAGES_BASE_PATH ?? "/apptest3",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // Emits a self-contained server bundle for the Docker image.
        output: "standalone" as const,
      }),
};

export default nextConfig;
