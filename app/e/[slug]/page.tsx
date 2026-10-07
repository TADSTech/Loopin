import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatEventWhen } from "@/lib/format";
import { SITE } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicEvent = {
  slug: string;
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  notes: string | null;
  is_public: boolean;
};

async function getEventPage(slug: string): Promise<PublicEvent | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("event_pages")
    .select("slug, title, start, end, location, notes, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (!data || !data.is_public) return null;
  return data as PublicEvent;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getEventPage(slug);

  if (!page) {
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  }

  const description =
    [formatEventWhen(page.start, page.end), page.location]
      .filter(Boolean)
      .join(" · ") || `Published with ${SITE.name}.`;

  return {
    title: page.title,
    description,
    alternates: { canonical: `/e/${slug}` },
    openGraph: {
      type: "article",
      title: page.title,
      description,
      url: `${SITE.url}/e/${slug}`,
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getEventPage(slug);

  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: page.title,
    startDate: page.start ?? undefined,
    endDate: page.end ?? undefined,
    description: page.notes ?? undefined,
    location: page.location
      ? { "@type": "Place", name: page.location }
      : undefined,
    url: `${SITE.url}/e/${slug}`,
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 sm:px-6 md:max-w-4xl">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2 py-3 -my-3">
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/"
            className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
          >
            Try Loopin free
          </Link>
        </header>

        <article className="flex-1 py-10 md:py-14">
          <p className="text-xs font-medium tracking-wide text-tertiary uppercase">
            Event
          </p>
          <h1 className="mt-2 font-display text-[32px] leading-[38px] font-bold tracking-tight text-foreground md:text-[40px] md:leading-[46px]">
            {page.title}
          </h1>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.start && (
              <div
                className={`rounded-lg border border-border bg-surface p-4 ${
                  page.location ? "" : "sm:col-span-2"
                }`}
              >
                <dt className="text-xs font-medium tracking-wide text-tertiary uppercase">
                  When
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatEventWhen(page.start, page.end)}
                </dd>
              </div>
            )}
            {page.location && (
              <div
                className={`rounded-lg border border-border bg-surface p-4 ${
                  page.start ? "" : "sm:col-span-2"
                }`}
              >
                <dt className="text-xs font-medium tracking-wide text-tertiary uppercase">
                  Where
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {page.location}
                </dd>
              </div>
            )}
            {page.notes && (
              <div className="rounded-lg border border-border bg-surface p-4 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-tertiary uppercase">
                  Details
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-tertiary">
                  {page.notes}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-8 text-xs text-tertiary">
            Published with{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              {SITE.name}
            </Link>
            . Turn screenshots and notes into synced calendar events.
          </p>
        </article>

        <footer className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-tertiary">
          <span>© 2026 loopin</span>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
          >
            Support
          </a>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
