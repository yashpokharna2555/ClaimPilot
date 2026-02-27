import Link from "next/link";
import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#1a2b4a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00b4d8]">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold">SwiftSettle</span>
            </div>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              AI-powered vehicle insurance claims. File in 60 seconds, get an estimate in hours.
            </p>
            <p className="mt-4 text-xs text-slate-400">Licensed in 48 states</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Product</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/how-it-works" className="text-sm text-slate-400 hover:text-white">How It Works</Link></li>
              <li><Link href="/pricing" className="text-sm text-slate-400 hover:text-white">Pricing</Link></li>
              <li><Link href="/claims/new" className="text-sm text-slate-400 hover:text-white">File a Claim</Link></li>
              <li><Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">Dashboard</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Company</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/about" className="text-sm text-slate-400 hover:text-white">About</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Press</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Careers</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Cookie Policy</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white">Licensing</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-8 flex flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} SwiftSettle Insurance Technologies, Inc. All rights reserved.</p>
          <p>256-bit TLS Encryption · BBB Accredited · NAIC Member</p>
        </div>
      </div>
    </footer>
  );
}
