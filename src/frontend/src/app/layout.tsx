import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kratos Agent",
  description:
    "Enterprise AI Agent powered by GitHub Copilot SDK & Microsoft Foundry",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface antialiased">{children}</body>
    </html>
  );
}
