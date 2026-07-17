import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MediAudit AI — Decode & dispute your medical bill",
  description:
    "A calm advocate that decodes cryptic medical billing codes, audits them for institutional errors, and hands you a ready-to-use action packet — in plain English.",
  openGraph: {
    images: [
      {
        url: "/thumbnail.jpg",
        width: 1200,
        height: 675,
        alt: "MediAudit AI — Decode & dispute your medical bill",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/thumbnail.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#14564a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hanken.variable} ${plexMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
