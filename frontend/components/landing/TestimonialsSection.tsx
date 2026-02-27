import { Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "I filmed the damage in my parking lot, uploaded it, and had an estimate appointment booked at a shop near me — all in under 10 minutes. This is how insurance should work.",
    name: "Marcus T.",
    state: "Texas",
    outcome: "Rear-end collision · Shop Estimate",
    stars: 5,
  },
  {
    quote:
      "My car was hit while parked. I didn't know what to do. SwiftSettle walked me through exactly what to film, figured out it wasn't safe to drive, and arranged a tow the same day.",
    name: "Priya K.",
    state: "California",
    outcome: "Wheel damage detected · Tow arranged",
    stars: 5,
  },
  {
    quote:
      "The hail storm wrecked my hood and roof. I filed the claim from my driveway. The AI caught damage I didn't even notice. Got a confirmation from the body shop in 2 hours.",
    name: "Dana W.",
    state: "Oklahoma",
    outcome: "Hail damage · 8 zones identified",
    stars: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1a2b4a] sm:text-4xl">
            Customers who never want to go back
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Real stories from real policyholders.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-2xl bg-slate-50 p-8 ring-1 ring-slate-200"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mt-4 text-slate-700 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Attribution */}
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="font-semibold text-[#1a2b4a]">{t.name}</p>
                <p className="text-sm text-slate-500">{t.state}</p>
                <p className="mt-1 text-xs font-medium text-[#00b4d8]">{t.outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
