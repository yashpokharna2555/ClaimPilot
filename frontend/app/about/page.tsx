import Link from "next/link";
import { Shield, Zap, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const VALUES = [
  {
    icon: Zap,
    title: "Speed is a claim right",
    body: "Waiting weeks for a claims adjuster isn't acceptable. We built an AI pipeline that processes evidence and routes your claim in under 10 minutes — because your time is valuable.",
  },
  {
    icon: Shield,
    title: "Transparency over fine print",
    body: "Every routing decision comes with a written explanation. You'll always know exactly why your claim was classified and what to do next.",
  },
  {
    icon: Users,
    title: "Human judgment for hard cases",
    body: "AI handles the straightforward claims. Complex or ambiguous situations are escalated to licensed human adjusters — with all the AI-extracted context pre-loaded.",
  },
  {
    icon: Globe,
    title: "Licensed, regulated, accountable",
    body: "SwiftSettle is licensed in 48 states and operates under the same regulatory framework as traditional carriers. We just process claims faster.",
  },
];

const TEAM = [
  { name: "Mara Chen", role: "CEO & Co-founder", bio: "Former VP of Claims at a top-5 carrier. 12 years making insurance actually work for people." },
  { name: "Jordan Okafor", role: "CTO & Co-founder", bio: "Built ML infrastructure at scale. Believes structured AI outputs beat black-box decisions every time." },
  { name: "Sofia Reyes", role: "Head of Underwriting", bio: "Licensed actuary with a track record of reducing fraud without punishing honest claimants." },
  { name: "Dev Patel", role: "Head of AI", bio: "Specializes in multimodal document understanding and entity extraction in high-stakes environments." },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-[#1a2b4a] py-24 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#00b4d8]">About SwiftSettle</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          We built the insurance company<br />we always wanted
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-slate-300">
          SwiftSettle was founded after our founders each spent months fighting with traditional insurers over straightforward claims. We knew technology could do better.
        </p>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-[#1a2b4a]">Our mission</h2>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          To make vehicle insurance claims as fast and certain as ordering a rideshare. Every policyholder deserves
          a clear, evidence-based decision — not an indefinite wait, not arbitrary human discretion, not endless paperwork.
        </p>
      </section>

      {/* Values */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-[#1a2b4a]">What we believe</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f7fb]">
                  <v.icon className="h-5 w-5 text-[#00b4d8]" />
                </div>
                <h3 className="mt-4 font-semibold text-[#1a2b4a]">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By the numbers */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-[#1a2b4a]">By the numbers</h2>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { stat: "48", label: "States licensed" },
              { stat: "12K+", label: "Repair partners" },
              { stat: "<10 min", label: "Avg. claim processing" },
              { stat: "94%", label: "SHOP_ESTIMATE auto-resolved" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-4xl font-black text-[#1a2b4a]">{item.stat}</p>
                <p className="mt-1 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-[#1a2b4a]">Leadership</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((person) => (
              <div key={person.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2b4a] text-xl font-bold text-white">
                  {person.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <p className="mt-4 font-semibold text-[#1a2b4a]">{person.name}</p>
                <p className="text-xs font-medium text-[#00b4d8]">{person.role}</p>
                <p className="mt-2 text-xs text-slate-500">{person.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-semibold text-[#1a2b4a]">Join thousands of drivers who switched</h2>
        <p className="mt-2 text-slate-500">Get a quote in 2 minutes. File your first claim in under 10.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/auth/register">
            <Button className="bg-[#1a2b4a] text-white hover:bg-[#0f1d33]">Get Started</Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline">How It Works</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
