import Link from "next/link";
import { Video, Cpu, BarChart2, Route, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    num: "01",
    icon: Video,
    title: "Record a 60-second walkaround",
    body: "Open SwiftSettle on your phone. Walk around your vehicle and capture six key shots — wide context, damage close-ups, wheels, dashboard, VIN/plate, and the other party if applicable. One continuous video is all it takes.",
    detail: [
      "Works on any smartphone — iOS or Android",
      "Low-light enhancement for nighttime incidents",
      "No special equipment needed",
    ],
  },
  {
    num: "02",
    icon: Cpu,
    title: "AI indexes and extracts evidence",
    body: "Reka Vision processes your video frame by frame, identifying every damage zone, VIN, license plate, warning light, and fluid leak. Our system pinpoints exact timestamps and extracts clips automatically.",
    detail: [
      "Powered by Reka Vision multimodal AI",
      "Identifies 12+ evidence categories",
      "Timestamped clips stored securely",
    ],
  },
  {
    num: "03",
    icon: BarChart2,
    title: "Structured claim is built",
    body: "Fastino GLiNER2 converts visual evidence into four machine-readable contracts: Vehicle Identity, Damage Map, Hazard & Drivability, and Submission Pack. Your coverage score is computed in seconds.",
    detail: [
      "Four structured output contracts",
      "Coverage score 0–100 with breakdown",
      "Missing evidence flagged with re-capture hints",
    ],
  },
  {
    num: "04",
    icon: Route,
    title: "Claim is routed deterministically",
    body: "Our policy engine applies rules against your coverage data and fraud graph to assign your claim to the right lane — Shop Estimate, Tow Required, Human Adjuster, or Fraud Review — with full reasoning.",
    detail: [
      "Four routing lanes with clear criteria",
      "Graph-based fraud detection",
      "Zero human subjectivity for standard claims",
    ],
  },
  {
    num: "05",
    icon: CheckCircle2,
    title: "Auto-submitted to repair portal",
    body: "For Shop Estimate claims, Yutori's browsing AI navigates directly to the repair shop intake form, fills in all the details, uploads your damage photos, and captures the confirmation number — no phone calls required.",
    detail: [
      "Yutori Browsing API handles form submission",
      "Confirmation ID returned in real time",
      "SSE notifications keep you in the loop",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-[#1a2b4a] py-20 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#00b4d8]">How It Works</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          From incident to resolution<br />in under 10 minutes
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          SwiftSettle replaces the phone-tag, paperwork, and waiting with an end-to-end AI pipeline — from your phone camera to the repair shop.
        </p>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {STEPS.map((step, i) => (
            <div key={step.num} className={`flex flex-col gap-8 sm:flex-row ${i % 2 === 1 ? "sm:flex-row-reverse" : ""}`}>
              <div className="flex shrink-0 items-start gap-5">
                <span className="text-5xl font-black text-slate-100 leading-none">{step.num}</span>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f7fb]">
                  <step.icon className="h-6 w-6 text-[#00b4d8]" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#1a2b4a]">{step.title}</h2>
                <p className="mt-2 text-slate-600">{step.body}</p>
                <ul className="mt-4 space-y-1.5">
                  {step.detail.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-slate-500">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00b4d8]" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack Callout */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-[#1a2b4a]">Built on best-in-class AI</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { name: "Reka Vision", desc: "Multimodal video understanding — indexes every frame and returns timestamped evidence segments." },
              { name: "Fastino GLiNER2", desc: "Local entity extraction and classification — structured claim data in a single model pass." },
              { name: "Yutori Browsing", desc: "Autonomous web agent — fills and submits repair portal forms without human intervention." },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-[#1a2b4a]">{t.name}</p>
                <p className="mt-2 text-sm text-slate-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-[#00b4d8]" />
        <h2 className="mt-4 text-2xl font-semibold text-[#1a2b4a]">Ready to file your first claim?</h2>
        <p className="mt-2 text-slate-500">Create a free account and get started in minutes.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/auth/register">
            <Button className="bg-[#1a2b4a] text-white hover:bg-[#0f1d33]">Get Started</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline">View Plans</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
