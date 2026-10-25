import { SITE } from "@/lib/site";
import { safeJsonLdStringify } from "@/lib/json-ld";

/**
 * Site-wide JSON-LD (Organization, WebSite, SoftwareApplication).
 * Server-rendered so crawlers see it in the initial HTML.
 */
export default function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/icon.png`,
        description: SITE.description,
        email: SITE.supportEmail,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: SITE.supportEmail,
            availableLanguage: ["English"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        publisher: { "@id": `${SITE.url}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Calendar & Scheduling",
        operatingSystem: "Web",
        url: SITE.url,
        description: SITE.description,
        featureList: [
          "AI event extraction from screenshots and images",
          "Event extraction from pasted notes",
          "One-click Google Calendar synchronization",
          "Saved event history",
        ],
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
            description: "3 extractions per month, no card required.",
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: "5",
            priceCurrency: "USD",
            description:
              "Unlimited extractions and hands-off Google Calendar sync.",
          },
        ],
        publisher: { "@id": `${SITE.url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Static, developer-authored JSON. Escaped as defence-in-depth.
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(graph) }}
    />
  );
}
