import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
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

// "Keep me signed in" (see startSession in authController.ts). Runs before the
// page's own code, so every page that reads sessionStorage sees the login.
const restoreRememberedLogin = `try {
  var r = JSON.parse(localStorage.getItem('autokita_remember') || 'null');
  if (r && r.exp > Date.now() && (r.flag === 'autokita_customer' || r.flag === 'autokita_admin')) {
    if (!sessionStorage.getItem('autokita_user_id')) {
      sessionStorage.setItem(r.flag, 'true');
      sessionStorage.setItem('autokita_user_id', String(r.userId));
      if (r.name) sessionStorage.setItem('autokita_user_name', r.name);
      if (r.title) sessionStorage.setItem('autokita_user_title', r.title);
    }
  } else if (r) {
    localStorage.removeItem('autokita_remember');
  }
} catch (e) {}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restoreRememberedLogin }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
      {children}
      <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
