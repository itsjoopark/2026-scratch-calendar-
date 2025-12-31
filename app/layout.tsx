import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2026 Tear-Off Calendar | 新年カレンダー",
  description: "Interactive Japanese-style tear-off calendar for New Year 2026. Drag to rip off pages and reveal the next day.",
  keywords: ["calendar", "2026", "new year", "tear-off", "interactive", "japanese"],
  authors: [{ name: "Calendar App" }],
  openGraph: {
    title: "2026 Tear-Off Calendar",
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
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
