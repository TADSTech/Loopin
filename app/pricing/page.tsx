"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import AuthModal from "../components/auth-modal";
import { createClient } from "@/lib/supabase/client";
import { PLANS, formatPrice, type Currency, type PlanId } from "@/lib/payments";
import { SITE } from "@/lib/site";

export default function PricingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [session, setSession] = useState<Session | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState("");
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .catch(() => {});
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const runCheckout = async (plan: PlanId) => {
    setBusyPlan(plan);
    setNotice("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, currency }),
      });
      const data = (await response.json()) as { url?: string };

      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setNotice(
        "Payments are being finalised. Create your account now and we'll email you the moment Pro is live.",
      );
    } catch {
      setNotice("Something went wrong starting checkout. Please try again.");
    } finally {
      setBusyPlan(null);
    }
  };

  const choosePlan = (plan: PlanId) => {
    setNotice("");
    if (plan === "free") {
      router.push("/");
      return;
    }
    if (plan === "team") {
      window.location.assign(
        "mailto:sales@loopin.app?subject=Loopin%20Team%20plan",
      );
      return;
    }
    if (!session) {
      setPendingPlan(plan);
      setShowAuth(true);
      return;
    }
    void runCheckout(plan);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 py-3 -my-3"
            aria-label="Back to Loopin"
          >
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/"
            className="flex h-11 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Back to app
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center py-10">
          <div className="max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              Simple, honest pricing
            </span>
            <h1 className="mt-4 font-display text-[32px] leading-[38px] font-bold tracking-tight text-foreground">
              Pay once. Sync forever.
            </h1>
            <p className="mt-3 text-base leading-[22px] text-tertiary">
              Start free, upgrade when you want hands-off AI extraction and
              one-click Google Calendar sync.
            </p>
          </div>

          {/* Currency toggle */}
          <div className="mt-7 flex rounded-full bg-surface-muted p-1">
            {(["USD", "NGN"] as Currency[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={currency === option}
                onClick={() => setCurrency(option)}
                className={`min-h-11 min-w-[92px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  currency === option
                    ? "bg-surface text-foreground"
                    : "text-tertiary hover:text-foreground"
                }`}
              >
                {option === "USD" ? "$ USD" : "₦ NGN"}
              </button>
            ))}
          </div>

          {notice && (
            <p className="mt-5 max-w-xl rounded-lg border border-primary-border bg-primary-soft px-4 py-3 text-center text-sm text-primary">
              {notice}
            </p>
          )}

          {/* Plans */}
          <div className="mt-8 grid w-full gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const price = formatPrice(plan.price[currency], currency);
              const isFree = plan.price[currency] === 0;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-lg border bg-surface p-6 ${
                    plan.highlight ? "border-primary-border" : "border-border"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-on-primary">
                      Most popular
                    </span>
                  )}
                  <h2 className="font-display text-lg font-medium text-foreground">
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-sm text-tertiary">{plan.tagline}</p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-[32px] leading-none font-bold tracking-tight text-foreground">
                      {price}
                    </span>
                    {!isFree && (
                      <span className="text-sm text-tertiary">/month</span>
                    )}
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-foreground"
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
                          className="mt-0.5 flex-shrink-0 text-primary"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => choosePlan(plan.id)}
                    disabled={busyPlan === plan.id}
                    className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                      plan.highlight
                        ? "bg-primary text-on-primary hover:bg-primary-hover"
                        : "border border-border text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {busyPlan === plan.id ? "Starting…" : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-8 max-w-xl text-center text-xs leading-relaxed text-tertiary">
            Prices in USD and Nigerian Naira (NGN). Cancel anytime. Secure
            checkout handles cards and bank transfers.
          </p>
        </div>

        <footer className="flex flex-col items-start gap-1 py-4 text-sm text-tertiary sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-5">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-x-5">
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Support
            </a>
            <a
              href="#"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Terms
            </a>
          </div>
        </footer>
      </div>

      {showAuth && (
        <AuthModal
          initialMode="signup"
          headline="Create your account to upgrade"
          description="We'll take you straight to a secure checkout once you're set up."
          onClose={() => setShowAuth(false)}
          onAuthed={() => {
            setShowAuth(false);
            if (pendingPlan) void runCheckout(pendingPlan);
            setPendingPlan(null);
          }}
        />
      )}
    </main>
  );
}
