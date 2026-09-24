import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

/** Display face for dish names — warmth and appetite appeal. */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

/** Body face — neutral, legible at small sizes in poor light. */
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse the menu, save favourites, and order from your table.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // iOS has no status-bar style that adapts to a theme. "black-translucent"
    // forces white status text, which vanishes over the light theme, so
    // "default" is the safer of the two. This only affects the installed
    // PWA on iOS; browsers use theme-color above, which does adapt.
    statusBarStyle: "default",
    title: "Menu",
  },
};

export const viewport: Viewport = {
  // One per OS scheme for the very first paint; the head script then points
  // both at whichever theme is actually active, including a manual choice.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  width: "device-width",
  initialScale: 1,
  // Let people zoom. Locking zoom on a menu is hostile to anyone who needs it.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme="light" is only the server's default. THEME_SCRIPT replaces
    // it before first paint, and suppressHydrationWarning tells React to keep
    // the corrected attribute rather than revert it during hydration.
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
