"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#1a2b4a] to-[#0f1d33] py-24 text-white sm:py-32">
      {/* Background grid texture */}
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0tNCA0aC0ydi0yaDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#00b4d8]/40 bg-[#00b4d8]/10 px-4 py-1.5 text-sm font-medium text-[#00b4d8]"
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            Rated #1 Claims Experience — 2025 Insurtech Awards
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            File your claim in{" "}
            <span className="text-[#00b4d8]">60 seconds.</span>
            <br />
            Get an estimate in hours.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-slate-300"
          >
            Record a quick damage video. Our AI extracts evidence, builds your claim, and
            automatically submits to a repair shop — no phone calls, no paperwork, no waiting on hold.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link href="/auth/register">
              <Button size="lg" className="gap-2 bg-[#00b4d8] hover:bg-[#0099bb] text-white px-8">
                File a Claim <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                See How It Works
              </Button>
            </Link>
          </motion.div>

          {/* Trust micro-signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#00b4d8]" /> Average claim: 4 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-[#00b4d8]" /> Licensed in 48 states
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-[#00b4d8]" /> 4.9/5 from 12,000+ customers
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
