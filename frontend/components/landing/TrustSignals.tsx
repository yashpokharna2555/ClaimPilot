import { ShieldCheck, Lock, Award, Car } from "lucide-react";

const signals = [
  { icon: ShieldCheck, label: "Licensed in 48 States" },
  { icon: Lock, label: "256-bit TLS Encryption" },
  { icon: Award, label: "BBB A+ Accredited" },
  { icon: Car, label: "12,000+ Repair Partners" },
];

export default function TrustSignals() {
  return (
    <section className="border-y border-slate-100 bg-slate-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
          {signals.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 text-slate-500">
              <s.icon className="h-5 w-5 text-[#00b4d8] shrink-0" />
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
