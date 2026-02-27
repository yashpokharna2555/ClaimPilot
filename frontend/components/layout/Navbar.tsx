"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a2b4a]">
              <Shield className="h-5 w-5 text-[#00b4d8]" />
            </div>
            <span className="text-xl font-semibold text-[#1a2b4a]">SwiftSettle</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="/how-it-works" className="text-sm font-medium text-slate-600 hover:text-[#1a2b4a]">
              How It Works
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-[#1a2b4a]">
              Pricing
            </Link>
            <Link href="/about" className="text-sm font-medium text-slate-600 hover:text-[#1a2b4a]">
              About
            </Link>
          </nav>

          {/* Auth actions */}
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-slate-600">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-[#1a2b4a] hover:bg-[#0f1d33] text-white">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-100 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-2">
              <Link href="/how-it-works" className="px-2 py-2 text-sm font-medium text-slate-600">How It Works</Link>
              <Link href="/pricing" className="px-2 py-2 text-sm font-medium text-slate-600">Pricing</Link>
              <Link href="/about" className="px-2 py-2 text-sm font-medium text-slate-600">About</Link>
              <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="w-full justify-start">Sign in</Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm" className="w-full bg-[#1a2b4a] text-white">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
