import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "New Year 2026 Tear-Off Calendar",
  description: "Interactive tear-off calendar for New Year 2026. Drag to rip off pages and reveal the next day.",
  keywords: ["calendar", "2026", "new year", "tear-off", "interactive"],
  authors: [{ name: "Jules Park" }],
  openGraph: {
    title: "New Year 2026 Tear-Off Calendar",
    description: "Interactive tear-off calendar for New Year 2026",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f0eee9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
