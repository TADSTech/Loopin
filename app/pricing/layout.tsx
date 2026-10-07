import type { Metadata } from "next";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Loopin pricing: free forever with 3 AI extractions a month, or Pro for unlimited extractions and hands-off Google Calendar sync. Pay in USD or Nigerian Naira (NGN).",
  keywords: [
    "Loopin pricing",
    "AI calendar app pricing",
    "calendar sync subscription",
    "USD NGN pricing",
  ],
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    url: `${SITE.url}/pricing`,
    siteName: SITE.name,
    title: `Pricing | ${SITE.name}`,
    description:
      "Free forever with 3 extractions a month, or upgrade to Pro for unlimited AI calendar extraction and sync. Billed in USD or NGN.",
  },
  twitter: {
    card: "summary_large_image",
    title: `Pricing | ${SITE.name}`,
    description:
      "Free forever with 3 extractions a month, or upgrade to Pro for unlimited AI calendar extraction and sync.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
