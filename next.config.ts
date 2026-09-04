import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle for the Docker image.
  output: "standalone",
};

export default nextConfig;
