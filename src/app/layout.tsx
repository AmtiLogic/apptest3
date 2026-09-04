import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * GitHub Pages serves the app under /<repo>, so metadata URLs need that prefix.
 * The manifest's own icon paths are relative, which needs no prefixing.
 */
const basePath = process.env.STATIC_EXPORT === "1" ? process.env.PAGES_BASE_PATH ?? "/apptest3" : "";

export const metadata: Metadata = {
  title: "Garmin Dashboard",
  description: "A personal dashboard for your Garmin Connect data",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "Garmin",
    // Matches the app background, so the iOS status bar blends into the page.
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: `${basePath}/icon.svg`, type: "image/svg+xml" }],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page paint behind the notch and home indicator; the shell adds the
  // safe-area padding back.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
