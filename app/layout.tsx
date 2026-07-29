import type { Metadata } from "next";
import type { ReactNode } from "react";
// @ts-ignore: global CSS import declaration not found in this project setup
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoKita — Smart Automotive Repair Shop Management",
  description:
    "Expert automotive care with real-time tracking, transparent pricing, and certified technicians.",
  icons: {
    icon: "/autokita-logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
