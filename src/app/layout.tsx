import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adobe OEM Analytics — Algolia",
  description: "Adobe OEM partnership usage analytics dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
