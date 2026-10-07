import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — AI Calendar Event Extraction`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#0b57d0",
    lang: "en",
    dir: "ltr",
    categories: ["productivity", "utilities", "business"],
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
