export type Currency = "USD" | "NGN";
export type PlanId = "free" | "pro" | "team";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in each currency's minor unit (cents / kobo). */
  price: Record<Currency, number>;
  cta: string;
  highlight?: boolean;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try the magic with your own keys.",
    price: { USD: 0, NGN: 0 },
    cta: "Start free",
    features: [
      "Preview extractions from notes & images",
      "Bring your own Groq API key",
      "Manual Google Calendar token",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "The full, hands-off experience.",
    price: { USD: 500, NGN: 750_000 },
    cta: "Upgrade to Pro",
    highlight: true,
    features: [
      "Unlimited AI extractions",
      "One-click Google Calendar sync",
      "Saved event history",
      "Managed AI — no API keys needed",
      "Priority email support",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "For assistants and small teams.",
    price: { USD: 1900, NGN: 2_850_000 },
    cta: "Contact sales",
    features: [
      "Everything in Pro",
      "Up to 5 seats",
      "Shared calendar destinations",
      "Centralised billing",
      "Priority onboarding",
    ],
  },
];

const LOCALES: Record<Currency, string> = {
  USD: "en-US",
  NGN: "en-NG",
};

export function formatPrice(minorUnits: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}
