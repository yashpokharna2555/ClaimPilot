import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Basic",
    price: 59,
    description: "Essential coverage for everyday drivers.",
    features: [
      "State minimum liability",
      "$1,000 deductible",
      "AI claims filing",
      "Email status updates",
      "1 vehicle",
    ],
    cta: "Get Basic",
    highlight: false,
  },
  {
    name: "Plus",
    price: 89,
    description: "Complete protection with faster resolution.",
    features: [
      "Comprehensive + collision",
      "$500 deductible",
      "AI claims filing",
      "Real-time SSE updates",
      "Rental car coverage",
      "Up to 2 vehicles",
      "Priority routing",
    ],
    cta: "Get Plus",
    highlight: true,
  },
  {
    name: "Premium",
    price: 149,
    description: "Full coverage with concierge-level service.",
    features: [
      "Everything in Plus",
      "$250 deductible",
      "Dedicated adjuster access",
      "Glass coverage included",
      "Roadside assistance",
      "Up to 4 vehicles",
      "Fraud protection",
      "Tow service included",
    ],
    cta: "Get Premium",
    highlight: false,
  },
];

export default function PricingSection() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1a2b4a] sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            All plans include AI-powered claims filing. No hidden fees.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.highlight
                  ? "bg-[#1a2b4a] text-white shadow-2xl ring-2 ring-[#00b4d8]"
                  : "bg-white shadow-sm ring-1 ring-slate-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#00b4d8] px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <h3 className={`text-lg font-semibold ${plan.highlight ? "text-white" : "text-[#1a2b4a]"}`}>
                  {plan.name}
                </h3>
                <p className={`mt-1 text-sm ${plan.highlight ? "text-slate-300" : "text-slate-500"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className={`text-sm ${plan.highlight ? "text-slate-300" : "text-slate-500"}`}>/mo</span>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight ? "text-[#00b4d8]" : "text-[#00b4d8]"}`} />
                    <span className={`text-sm ${plan.highlight ? "text-slate-200" : "text-slate-600"}`}>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link href="/auth/register" className="mt-8">
                <Button
                  size="lg"
                  className={`w-full ${
                    plan.highlight
                      ? "bg-[#00b4d8] hover:bg-[#0099bb] text-white"
                      : "bg-[#1a2b4a] hover:bg-[#0f1d33] text-white"
                  }`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
