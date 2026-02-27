import { Video, Upload, Cpu, Route, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Video,
    title: "Record Your Walkthrough",
    description:
      "Follow our guided prompts to record a 60-second damage video — VIN, plates, dashboard, and every damaged area.",
    step: "01",
  },
  {
    icon: Upload,
    title: "Upload Instantly",
    description:
      "Drop your video into the app. We upload it to our secure servers and begin processing immediately.",
    step: "02",
  },
  {
    icon: Cpu,
    title: "AI Extracts Evidence",
    description:
      "Our vision AI identifies damage zones, reads your VIN and plate, assesses severity, and builds a complete evidence bundle.",
    step: "03",
  },
  {
    icon: Route,
    title: "Claim Gets Routed",
    description:
      "A deterministic policy engine decides: shop estimate, tow request, or adjuster review — no guesswork, no delays.",
    step: "04",
  },
  {
    icon: CheckCircle,
    title: "Auto-Submitted to Shop",
    description:
      "We file your claim directly with a repair shop or estimate portal. You get a confirmation number, not a voicemail.",
    step: "05",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1a2b4a] sm:text-4xl">
            From incident to estimate — fully automated
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            No phone trees. No adjusters playing phone tag. Five steps, fully automated.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step.step} className="relative flex flex-col items-center text-center">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute top-8 left-[calc(50%+2rem)] hidden h-px w-full bg-slate-200 md:block" />
              )}

              {/* Icon circle */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f7fb]">
                <step.icon className="h-7 w-7 text-[#00b4d8]" />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a2b4a] text-xs font-bold text-white">
                  {step.step}
                </span>
              </div>

              <h3 className="mt-4 font-semibold text-[#1a2b4a]">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
