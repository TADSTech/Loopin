import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developers",
  description: "Manage your Loopin API keys and webhooks.",
  robots: { index: false, follow: false },
};

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
