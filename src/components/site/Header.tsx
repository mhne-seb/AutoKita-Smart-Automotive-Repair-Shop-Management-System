'use client'

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Logo } from "./Logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { groups } from "@/controllers/servicesController";

const NAV = [
  { to: "/", label: "Home", hasDropdown: false },
  { to: "/about", label: "About", hasDropdown: false },
  { to: "/contact", label: "Contact", hasDropdown: false },
  { to: "/services", label: "Services", hasDropdown: true },
] as const;

export function Header({ variant = "light" }: { variant?: "light" | "transparent" }) {
  const pathname = usePathname();
  const scrolled = useScrolled(20);
  const [servicesOpen, setServicesOpen] = useState(false);

  const base = "fixed top-0 left-0 right-0 z-50 transition-all duration-300";
  const surface =
    variant === "transparent" && !scrolled
      ? "bg-transparent border-b border-transparent"
      : `glass-nav ${scrolled ? "glass-nav-scrolled shadow-sm shadow-black/5" : ""}`;
  const textOnDark = variant === "transparent" && !scrolled;

  return (
    <>
      <header className={`${base} ${surface}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className={`transition-transform duration-300 hover:scale-105 ${
              textOnDark ? "text-white" : "text-foreground"
            }`}
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => {
              const active =
                pathname === item.to || (item.hasDropdown && pathname.startsWith("/services"));
              const cls = textOnDark
                ? active
                  ? "text-white font-semibold"
                  : "text-white/80 hover:text-white"
                : active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground";
              const underline = textOnDark ? "bg-white" : "bg-brand";

              if (item.hasDropdown) {
                return (
                  <div
                    key={item.to}
                    className="relative"
                    onMouseEnter={() => setServicesOpen(true)}
                    onMouseLeave={() => setServicesOpen(false)}
                  >
                    <Link
                      href={item.to}
                      onClick={() => setServicesOpen((v) => !v)}
                      className={`group relative flex items-center gap-1 text-base transition-colors duration-300 ${cls}`}
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          servicesOpen ? "rotate-180" : ""
                        }`}
                      />
                      <span
                        className={`absolute -bottom-1 left-0 h-[1.5px] ${underline} transition-all duration-300 ease-out ${
                          active ? "w-full" : "w-0 group-hover:w-full"
                        }`}
                      />
                    </Link>

                    {/* Dropdown panel */}
                    <div
                      className={`absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-3 transition-all duration-200 ${
                        servicesOpen
                          ? "pointer-events-auto translate-y-0 opacity-100"
                          : "pointer-events-none -translate-y-1 opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden rounded-xl border bg-white shadow-xl shadow-black/10">
                        {groups.map((g) => (
                          <Link
                            key={g.code}
                            href={`/services/${g.code.toLowerCase()}`}
                            onClick={() => setServicesOpen(false)}
                            className="block border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors last:border-b-0 hover:bg-brand-soft hover:text-brand"
                          >
                            {g.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={`group relative text-base transition-colors duration-300 ${cls}`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-[1.5px] ${underline} transition-all duration-300 ease-out ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-[#1e3a5f] px-5 py-2.5 text-base font-semibold text-white shadow-md shadow-black/10 transition-all duration-300 hover:scale-[1.03] hover:bg-[#254a75] active:scale-[0.98]"
            >
              Log in
            </Link>

            <Link
              href="/book"
              className={`relative inline-flex items-center overflow-hidden rounded-md px-5 py-2.5 text-base font-medium transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] ${
                textOnDark
                  ? "bg-white text-brand shadow-md shadow-black/10 hover:shadow-lg hover:bg-white/90"
                  : "bg-brand text-brand-foreground shadow-md shadow-brand/20 hover:shadow-lg hover:opacity-90"
              }`}
            >
              <span className="relative z-10">Book Service</span>
              <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 ease-out hover:translate-x-0" />
            </Link>
          </div>
        </div>
      </header>
      {variant !== "transparent" && <div className="h-16" />}
    </>
  );
}
