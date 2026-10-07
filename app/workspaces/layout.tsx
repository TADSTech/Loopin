import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspaces",
  description: "Manage shared Loopin workspaces and members.",
  robots: { index: false, follow: false },
};

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
