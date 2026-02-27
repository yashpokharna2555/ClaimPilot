import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Basic",
    price: 59,
    tagline: "Essential coverage for everyday drivers",
    highlight: false,
    features: [
      { text: "Liability: $50K / $100K bodily injury", included: true },
      { text: "Property damage: $25K", included: true },
      { text: "AI-powered claim filing", included: true },
      { text: "Deductible: $1,000", included: true },
      { text: "24/7 roadside assistance", included: true },
      { text: "Rental car coverage", included: false },
      { text: "Uninsured motorist protection", included: false },
      { text: "Gap insurance", included: false },
      { text: "Priority adjuster routing", included: false },
    ],
  },
  {
    name: "Plus",
    price: 89,
    tagline: "Our most popular plan",
    highlight: true,
    features: [
      { text: "Liability: $100K / $300K bodily injury", included: true },
      { text: "Property damage: $50K", included: true },
      { text: "AI-powered claim filing", included: true },
      { text: "Deductible: $500", included: true },
      { text: "24/7 roadside assistance", included: true },
      { text: "Rental car coverage (up to $45/day)", included: true },
      { text: "Uninsured motorist protection", included: true },
      { text: "Gap insurance", included: false },
      { text: "Priority adjuster routing", included: false },
    ],
  },
  {
    name: "Premium",
    price: 149,
    tagline: "Complete protection, zero compromises",
    highlight: false,
    features: [
      { text: "Liability: $250K / $500K bodily injury", included: true },
      { text: "Property damage: $100K", included: true },
      { text: "AI-powered claim filing", included: true },
      { text: "Deductible: $250", included: true },
      { text: "24/7 roadside assistance", included: true },
      { text: "Rental car coverage (up to $75/day)", included: true },
      { text: "Uninsured motorist protection", included: true },
      { text: "Gap insurance", included: true },
      { text: "Priority adjuster routing", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "How does AI-powered claims work?",
    a: "You record a 60-second walkaround video of the damage. Our AI indexes every frame, extracts structured evidence, scores your coverage, and auto-routes your claim — often resolving in under 10 minutes.",
  },
  {
    q: "Can I switch plans mid-policy?",
    a: "Yes. Plan upgrades take effect immediately; downgrades apply at your next renewal date. You only pay the prorated difference.",
  },
  {
    q: "What states are you licensed in?",
    a: "SwiftSettle is currently licensed in 48 states. We are not yet available in Hawaii and Alaska but expect to expand in the coming months.",
  },
  {
    q: "Is my video data stored securely?",
    a: "All videos are encrypted at rest and in transit using 256-bit AES. Evidence clips are retained for the duration of the claim and 7 years after resolution as required by law.",
  },
  {
    q: "What happens if my claim goes to a human adjuster?",
    a: "Complex claims (high severity, airbag deployment, or fraud indicators) are routed to a licensed adjuster who contacts you within 1 business day. Our AI pre-populates the adjuster file with all extracted evidence.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-[#1a2b4a] py-20 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#00b4d8]">Pricing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          No hidden fees. No multi-page policies. Pick the coverage that fits your life — change anytime.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 shadow-sm ring-1 ${
                plan.highlight
                  ? "bg-[#1a2b4a] text-white ring-[#1a2b4a]"
                  : "bg-white text-slate-800 ring-slate-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#00b4d8] px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <p className={`text-sm font-semibold ${plan.highlight ? "text-[#00b4d8]" : "text-[#00b4d8]"}`}>{plan.name}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className={`text-sm ${plan.highlight ? "text-slate-300" : "text-slate-400"}`}>/mo</span>
              </div>
              <p className={`mt-1 text-sm ${plan.highlight ? "text-slate-300" : "text-slate-500"}`}>{plan.tagline}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    {f.included ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00b4d8]" />
                    ) : (
                      <X className={`h-5 w-5 shrink-0 ${plan.highlight ? "text-slate-500" : "text-slate-300"}`} />
                    )}
                    <span className={`text-sm ${!f.included ? (plan.highlight ? "text-slate-500" : "text-slate-400") : ""}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link href="/auth/register">
                  <Button
                    className={`w-full ${plan.highlight ? "bg-[#00b4d8] hover:bg-[#0099bb] text-white" : "bg-[#1a2b4a] hover:bg-[#0f1d33] text-white"}`}
                  >
                    Get {plan.name}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          All plans include state-mandated minimums. Rates vary by driving history and location. Get a personalized quote at sign-up.
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-[#1a2b4a]">Frequently asked questions</h2>
          <div className="mt-10 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-[#1a2b4a]">{item.q}</p>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-semibold text-[#1a2b4a]">Start your policy today</h2>
        <p className="mt-2 text-slate-500">No commitment. Cancel anytime. Claims resolved faster than any traditional insurer.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/auth/register">
            <Button className="bg-[#1a2b4a] text-white hover:bg-[#0f1d33]">Create Account</Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline">See How It Works</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
