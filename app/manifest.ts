import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Digital Menu",
    short_name: "Menu",
    description: "Browse the menu, save favourites, and order from your table.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfcfa",
    theme_color: "#fdfcfa",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
