"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Link, Cpu, Video, Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const PROCESSING_STEPS = [
  { label: "Indexing with Reka Vision", icon: Video },
  { label: "Extracting Evidence", icon: Search },
  { label: "Analyzing Damage", icon: Cpu },
  { label: "Auto-classifying Incident", icon: Zap },
  { label: "Scoring Coverage", icon: CheckCircle },
];

const STEP_LABELS = ["Video URL", "Processing", "Done"];

export default function NewClaimPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [videoUrl, setVideoUrl] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [description, setDescription] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState("");

  async function submitClaim() {
    if (!videoUrl || !videoUrl.startsWith("https://")) {
      setError("Please enter a valid HTTPS video URL (e.g. YouTube Shorts).");
      return;
    }
    setStep(2);
    setError("");

    const timer = setInterval(() => {
      setProcessingStep((p) => (p < PROCESSING_STEPS.length - 1 ? p + 1 : p));
    }, 2500);

    try {
      const res = await fetch(`${API}/claims/new`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          video_url: videoUrl,
          incident_date: incidentDate || undefined,
          description: description || undefined,
        }),
      });
      clearInterval(timer);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to file claim");
      }
      const { claim_id } = await res.json();
      setProcessingStep(PROCESSING_STEPS.length - 1);
      setTimeout(() => router.push(`/claims/${claim_id}`), 1200);
    } catch (err: unknown) {
      clearInterval(timer);
      setError(err instanceof Error ? err.message : "Failed to file claim");
      setStep(1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Step indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  s < step ? "bg-[#00b4d8] text-white" :
                  s === step ? "bg-[#1a2b4a] text-white" :
                  "bg-slate-200 text-slate-400"
                }`}>
                  {s < step ? "✓" : s}
                </div>
                <span className="mt-1 hidden text-xs text-slate-400 sm:block">
                  {STEP_LABELS[s - 1]}
                </span>
              </div>
            ))}
          </div>
          <Progress value={(step / 3) * 100} className="mt-3 h-1.5" />
        </div>

        {/* Step 1: Video URL */}
        {step === 1 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-[#1a2b4a]">Enter Video URL</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste a YouTube Shorts or any public video URL — Reka Vision will analyze it directly.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            {/* URL input */}
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Video URL <span className="font-normal text-slate-400">(must start with https://)</span>
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/shorts/..."
                  className="pl-9"
                />
              </div>
              {videoUrl && (
                <p className={`mt-1.5 text-xs ${videoUrl.startsWith("https://") ? "text-green-600" : "text-red-500"}`}>
                  {videoUrl.startsWith("https://") ? "✓ Valid URL format" : "URL must start with https://"}
                </p>
              )}
            </div>

            {/* Optional fields */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Incident Date{" "}
                  <span className="font-normal text-slate-400">(optional — defaults to today)</span>
                </label>
                <Input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description{" "}
                  <span className="font-normal text-slate-400">(optional — AI will generate one)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
                  placeholder="Add any context you'd like the adjuster to know..."
                />
              </div>
            </div>

            <Button
              onClick={submitClaim}
              disabled={!videoUrl}
              className="mt-6 w-full bg-[#00b4d8] hover:bg-[#0099bb] text-white"
            >
              Analyze Video →
            </Button>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7fb]">
              <Cpu className="h-8 w-8 animate-pulse text-[#00b4d8]" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[#1a2b4a]">Analyzing your claim</h2>
            <p className="mt-1 text-sm text-slate-500">This usually takes 1–3 minutes</p>

            <div className="mt-8 space-y-3">
              {PROCESSING_STEPS.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                    i < processingStep
                      ? "bg-green-50 text-green-700"
                      : i === processingStep
                      ? "bg-[#e8f7fb] text-[#1a2b4a] font-medium"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {i < processingStep ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : i === processingStep ? (
                    <s.icon className="h-4 w-4 shrink-0 animate-pulse text-[#00b4d8]" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border border-slate-300" />
                  )}
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
