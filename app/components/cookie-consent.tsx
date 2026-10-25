"use client";

import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "loopin_cookie_consent";

export type CookieCategory =
  | "essential"
  | "analytics"
  | "advertising"
  | "functional";

const CookieDescriptions: Record<CookieCategory, string> = {
  essential:
    "Essential cookies enable core functionality such as authentication, security, and network management. These cookies do not store any personally identifiable information.",
  analytics:
    "Analytics cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve the user experience.",
  advertising:
    "Advertising cookies may be used to show you relevant ads both on and off our site. They remember that you visited our site and may share this information with third-party advertising partners.",
  functional:
    "Functional cookies perform specific functions like remembering your preferences, choices, and previous activity on the site (e.g., your username, language, or region).",
};

const CookieButton = ({
  category,
  isSelected,
  onToggle,
}: {
  category: CookieCategory;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
}) => {
  const buttonClass = isSelected
    ? "flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-primary-soft text-primary"
    : "flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-surface-muted transition-colors cursor-pointer";
  return (
    <div
      className={buttonClass}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
      <span className="text-sm font-medium text-foreground">{category}</span>
    </div>
  );
};

const CategoryRow = ({
  category,
  isSelected,
  onToggle,
}: {
  category: CookieCategory;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
}) => {
  return (
    <div className="space-y-2">
      <p className="text-xs text-tertiary">{CookieDescriptions[category]}</p>
      <div className="flex gap-2">
        <CookieButton
          category={category}
          isSelected={isSelected}
          onToggle={() => onToggle(true)}
        />
        <CookieButton
          category={category}
          isSelected={!isSelected}
          onToggle={() => onToggle(false)}
        />
      </div>
    </div>
  );
};

export default function CookieConsent() {
  const [consented, setConsented] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<CookieCategory[]>([]);

  // Check if consent was already given
  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      setConsented(data.consented);
      setSelectedCategories(data.categories || []);
    }
  }, []);

  // Store consent when user toggles
  useEffect(() => {
    if (consented) {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
        consented: true,
        categories: selectedCategories,
      }));
    } else {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
    }
  }, [consented, selectedCategories]);

  // If not consented, show the banner; if consented, don't render
  if (consented) return null;

  const handleCategoryToggle = (category: CookieCategory, selected: boolean) => {
    if (selected) {
      setSelectedCategories((prev) => [...new Set([...prev, category])]);
    } else {
      setSelectedCategories((prev) => prev.filter((c) => c !== category));
    }
  };

  const handleAccept = () => {
    // Essential cookies are always allowed; others depend on selection
    const hasNonEssential =
      selectedCategories.some(
        (c) => c !== "essential"
      );
    setConsented(!hasNonEssential || window.confirm(
      "Essential cookies are required for the site to function. " +
      (hasNonEssential
        ? "Do you consent to analytics, advertising, and functional cookies?"
        : "No non-essential cookies will be stored.")
    ));
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 py-3 sm:py-3.5 text-sm text-tertiary animate-fade-in backdrop-blur-md"
      suppressHydrationWarning
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <p className="flex flex-wrap items-center justify-center sm:justify-start gap-x-1.5 gap-y-1 text-xs sm:text-sm leading-relaxed">
          <span>
            To make Loopin work best, we and our third-party providers use cookies
          </span>
          <button
            type="button"
            className="font-medium text-primary hover:underline cursor-pointer"
            onClick={() => {
              setSelectedCategories(["essential", "analytics", "functional"]);
              setConsented(true);
            }}
          >
            I agree
          </button>
          <span>
            to the use of cookies as described in our{" "}
            <a href="/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </p>
      </div>
    </div>
  );
}