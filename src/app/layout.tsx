import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenRun — find a hoop near you",
  description:
    "Live map of basketball courts near you, estimated busyness, and a shareable availability calendar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
