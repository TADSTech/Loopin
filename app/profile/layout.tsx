import type { Metadata } from "next";

// Account-only page — keep it out of search results.
export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your Loopin account, usage, and calendar connection.",
  robots: { index: false, follow: false },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
