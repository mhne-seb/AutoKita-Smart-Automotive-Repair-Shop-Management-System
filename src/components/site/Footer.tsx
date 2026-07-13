import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo className="text-foreground" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Expert automotive care with transparent tracking and digital management.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link href="/book" className="hover:text-foreground">Book Now</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Support</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a className="hover:text-foreground" href="#">FAQ</a></li>
              <li><a className="hover:text-foreground" href="#">Service Policies</a></li>
              <li><a className="hover:text-foreground" href="#">Warranty</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Connect</h4>
            <div className="mt-4 flex gap-3 text-muted-foreground">
              <a href="#" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
              <a href="#" aria-label="Twitter"><Twitter className="h-4 w-4" /></a>
              <a href="#" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
              <a href="#" aria-label="LinkedIn"><Linkedin className="h-4 w-4" /></a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">admin@autokita.com</p>
            <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
          </div>
        </div>
        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © 2026 AutoKita: A Smart Automotive Repair Shop Management. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
