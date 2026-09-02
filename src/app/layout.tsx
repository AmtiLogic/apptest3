import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garmin Dashboard",
  description: "A personal dashboard for your Garmin Connect data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
