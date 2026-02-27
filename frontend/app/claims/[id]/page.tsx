"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle, Clock, Truck, UserCheck, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INSURANCE_PORTAL = process.env.NEXT_PUBLIC_INSURANCE_PORTAL_URL ?? "https://insecureco.vercel.app";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { Authorization: `Bearer ${token}` };
}

const LANE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; action: string }> = {
  SHOP_ESTIMATE: { label: "Shop Estimate", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle, action: "Submit for Estimate" },
  TOW_REQUIRED: { label: "Tow Required", color: "bg-red-100 text-red-700 border-red-200", icon: Truck, action: "Request Tow" },
  HUMAN_ADJUSTER: { label: "Adjuster Review", color: "bg-amber-100 text-amber-700 border-amber-200", icon: UserCheck, action: "Schedule Review" },
  FRAUD_REVIEW: { label: "Fraud Review", color: "bg-purple-100 text-purple-700 border-purple-200", icon: AlertTriangle, action: "Contact Support" },
};

type ClipType = { clip_type: string; clip_id: string; clip_url: string; caption: string; start_s: number; end_s: number; confidence: number };
type ClaimType = { id: string; status: string; incident_type: string; filed_at: string; lane: string | null; coverage_score: number | null; fraud_risk: string | null };
type RoutingType = { lane: string; coverage_score: number; fraud_risk: string; review_reasons: string[]; recapture_hint: string | null };
type ClaimJsonType = {
  vehicle_identity?: { make_model_guess?: string; vin_visible?: boolean; plate_visible?: boolean; confidence?: number };
  damage_map?: { damage_zones?: string[]; damage_types?: string[]; severity?: string; incident_type?: string };
  hazards?: { airbag_deployed?: boolean; warning_lights_present?: boolean; drivable?: boolean };
};

function ExtractionLog({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLog() {
    if (log) { setOpen((o) => !o); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/claims/${claimId}/log`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Log not available yet");
      setLog(await res.json());
      setOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        onClick={loadLog}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[#1a2b4a]">Extraction Log (Debug)</span>
        {loading ? (
          <Clock className="h-4 w-4 animate-pulse text-slate-400" />
        ) : open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {error && <p className="px-6 pb-4 text-xs text-red-500">{error}</p>}
      {open && log && (
        <div className="border-t border-slate-100 px-6 py-4">
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs text-slate-700 ring-1 ring-slate-200">
            {JSON.stringify(log, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimType | null>(null);
  const [clips, setClips] = useState<ClipType[]>([]);
  const [routing, setRouting] = useState<RoutingType | null>(null);
  const [claimJson, setClaimJson] = useState<ClaimJsonType | null>(null);
  const [submission, setSubmission] = useState<{ status: string; confirmation_id: string | null } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function submitToInsureCo() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API}/claims/${id}/submit`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Submission failed");
      }
      const data = await res.json();
      setSubmission({ status: data.status, confirmation_id: data.confirmation_id ?? null });
      setStatusMsg("Submitted to InsureCo — Yutori is filing the form now.");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!id) return;

    fetch(`${API}/claims/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => { setClaim(data); if (data.claim_json) setClaimJson(data.claim_json); });

    fetch(`${API}/claims/${id}/evidence`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((b) => setClips(b.clips ?? []));

    fetch(`${API}/claims/${id}/routing`, { headers: authHeaders() })
      .then((r) => r.status === 202 ? null : r.json())
      .then((data) => data && setRouting(data));

    // Poll submission status while Yutori is running (every 30s)
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    function startSubmissionPoll() {
      pollInterval = setInterval(async () => {
        const res = await fetch(`${API}/claims/${id}/submission`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setSubmission(data);
        if (data.status === "succeeded" || data.status === "failed") {
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 30_000);
    }
    fetch(`${API}/claims/${id}/submission`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setSubmission(data);
          if (data.status !== "succeeded" && data.status !== "failed") startSubmissionPoll();
        }
      });

    // SSE stream
    const token = localStorage.getItem("access_token");
    const es = new EventSource(`${API}/claims/${id}/stream?token=${token}`);
    es.addEventListener("processing_complete", (e) => {
      const data = JSON.parse(e.data);
      setStatusMsg(`Claim processed — Lane: ${data.lane}, Score: ${data.coverage_score}`);
      setClaim((prev) => prev ? { ...prev, status: "complete", lane: data.lane, coverage_score: data.coverage_score } : prev);
      // Reload clips after processing completes
      fetch(`${API}/claims/${id}/evidence`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((b) => setClips(b.clips ?? []));
    });
    es.addEventListener("submission_update", (e) => {
      const data = JSON.parse(e.data);
      setSubmission(data);
      if (data.status === "succeeded" || data.status === "failed") {
        if (pollInterval) clearInterval(pollInterval);
      } else {
        startSubmissionPoll();
      }
    });
    return () => { es.close(); if (pollInterval) clearInterval(pollInterval); };
  }, [id]);

  if (!claim) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center text-slate-400">
          <Clock className="mx-auto h-10 w-10 animate-pulse" />
          <p className="mt-3">Loading claim...</p>
        </div>
      </div>
    );
  }

  const lane = routing?.lane ?? claim.lane;
  const score = routing?.coverage_score ?? claim.coverage_score ?? 0;
  const laneConfig = lane ? LANE_CONFIG[lane] : null;

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Claim #{claim.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="mt-1 text-2xl font-semibold capitalize text-[#1a2b4a]">
              {claim.incident_type.replace(/_/g, " ")}
            </h1>
            <p className="text-sm text-slate-400">Filed {new Date(claim.filed_at).toLocaleDateString()}</p>
          </div>
          <Badge className={`capitalize px-3 py-1 ${
            claim.status === "complete" ? "bg-green-100 text-green-700" :
            claim.status === "processing" ? "bg-blue-100 text-blue-700" :
            "bg-slate-100 text-slate-600"
          }`}>
            {claim.status}
          </Badge>
        </div>

        {statusMsg && (
          <div className="mt-4 rounded-lg bg-[#e8f7fb] px-4 py-3 text-sm text-[#1a2b4a]">
            ✓ {statusMsg}
          </div>
        )}

        {/* Coverage Score */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Evidence Coverage Score</p>
              <p className="mt-1 text-4xl font-bold text-[#1a2b4a]">{score}<span className="text-lg text-slate-400">/100</span></p>
            </div>
            {laneConfig && (
              <div className={`flex items-center gap-2 rounded-full border px-4 py-2 ${laneConfig.color}`}>
                <laneConfig.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{laneConfig.label}</span>
              </div>
            )}
          </div>
          <Progress value={score} className="mt-4 h-2" />

          {routing?.review_reasons && routing.review_reasons.length > 0 && (
            <ul className="mt-4 space-y-1">
              {routing.review_reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {r}
                </li>
              ))}
            </ul>
          )}

          {routing?.recapture_hint && (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-sm text-amber-800"><strong>Improve your score:</strong> {routing.recapture_hint}</p>
            </div>
          )}

          {laneConfig && !submission && (
            <div className="mt-6">
              <Button
                onClick={submitToInsureCo}
                disabled={submitting}
                className={`w-full ${lane === "SHOP_ESTIMATE" ? "bg-[#1a2b4a]" : "bg-amber-600"} text-white`}
              >
                {submitting ? "Submitting to InsureCo…" : laneConfig.action}
              </Button>
              {submitError && (
                <p className="mt-2 text-center text-xs text-red-500">{submitError}</p>
              )}
              <p className="mt-2 text-center text-xs text-slate-400">
                This will log into InsureCo and file the claim automatically via Yutori.
              </p>
            </div>
          )}
          {submission && (
            <div className={`mt-6 rounded-lg px-4 py-3 text-sm ${
              submission.status === "succeeded" ? "bg-green-50 text-green-700" :
              submission.status === "failed" ? "bg-red-50 text-red-700" :
              "bg-indigo-50 text-indigo-700"
            }`}>
              {submission.status === "succeeded" ? (
                <>✓ Filed with InsureCo{submission.confirmation_id && <span className="ml-2 font-mono font-semibold">{submission.confirmation_id}</span>}</>
              ) : submission.status === "failed" ? (
                "✗ Filing failed — check backend logs"
              ) : (
                <span className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  Yutori is filing the claim… this takes 6–7 minutes
                </span>
              )}
            </div>
          )}
        </div>

        {/* AI Extraction Results (Fastino / GLiNER2) */}
        {claimJson && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f7fb]">
                <span className="text-sm">🧠</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#1a2b4a]">AI Extraction Results</h2>
                <p className="text-xs text-slate-400">Extracted by Fastino GLiNER2 — running locally inside backend</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Vehicle */}
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Vehicle Identity</p>
                <p className="text-sm font-medium text-slate-800">{claimJson.vehicle_identity?.make_model_guess || "Unknown"}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {claimJson.vehicle_identity?.vin_visible && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">VIN visible</span>}
                  {claimJson.vehicle_identity?.plate_visible && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Plate visible</span>}
                  {!claimJson.vehicle_identity?.vin_visible && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">No VIN</span>}
                </div>
              </div>
              {/* Damage */}
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Damage Map</p>
                {claimJson.damage_map?.damage_zones && claimJson.damage_map.damage_zones.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {claimJson.damage_map.damage_zones.map((z, i) => (
                      <span key={i} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{z}</span>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400">No zones extracted</p>}
                {claimJson.damage_map?.severity && (
                  <p className="mt-2 text-xs text-slate-500">Severity: <span className="font-medium">{claimJson.damage_map.severity}</span></p>
                )}
              </div>
              {/* Hazards */}
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Hazards</p>
                <div className="flex flex-col gap-1.5">
                  <span className={`flex items-center gap-1.5 text-xs ${claimJson.hazards?.airbag_deployed ? "text-red-600 font-medium" : "text-slate-400"}`}>
                    <span>{claimJson.hazards?.airbag_deployed ? "🔴" : "⚪"}</span> Airbag {claimJson.hazards?.airbag_deployed ? "deployed" : "not deployed"}
                  </span>
                  <span className={`flex items-center gap-1.5 text-xs ${claimJson.hazards?.warning_lights_present ? "text-amber-600 font-medium" : "text-slate-400"}`}>
                    <span>{claimJson.hazards?.warning_lights_present ? "🟡" : "⚪"}</span> Warning lights {claimJson.hazards?.warning_lights_present ? "on" : "off"}
                  </span>
                  <span className={`flex items-center gap-1.5 text-xs ${claimJson.hazards?.drivable ? "text-green-600" : "text-red-600"}`}>
                    <span>{claimJson.hazards?.drivable ? "🟢" : "🔴"}</span> {claimJson.hazards?.drivable ? "Drivable" : "Not drivable"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Clips */}
        {clips.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#1a2b4a]">Evidence Clips</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {clips.map((clip) => (
                <div key={clip.clip_id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 hover:ring-[#00b4d8] transition-all">
                  {clip.clip_url ? (
                    <video
                      src={clip.clip_url}
                      controls
                      className="h-48 w-full object-cover bg-slate-100"
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-slate-100">
                      <p className="text-xs text-slate-400">No clip URL</p>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{clip.clip_type.replace(/_/g, " ")}</p>
                    {clip.caption && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{clip.caption}</p>
                    )}
                    <div className="mt-2 h-1 rounded-full bg-slate-100">
                      <div className="h-1 rounded-full bg-[#00b4d8]" style={{ width: `${clip.confidence * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{Math.round(clip.confidence * 100)}% confidence</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submission Status */}
        {submission && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-[#1a2b4a]">InsureCo Submission</h2>
            <div className="mt-3 flex items-center gap-3">
              <Badge className={
                submission.status === "succeeded" ? "bg-green-100 text-green-700" :
                submission.status === "failed" ? "bg-red-100 text-red-700" :
                "bg-indigo-100 text-indigo-700"
              }>
                {submission.status === "succeeded" ? "Filed" :
                 submission.status === "failed" ? "Failed" : "In Progress"}
              </Badge>
              {submission.confirmation_id && (
                <span className="font-mono text-sm font-semibold text-slate-700">{submission.confirmation_id}</span>
              )}
            </div>
            {!["succeeded", "failed"].includes(submission.status) && (
              <p className="mt-2 text-xs text-slate-400">Yutori browser automation is logging in and filling the InsureCo form. Updates every 30s.</p>
            )}
            {submission.confirmation_id && (
              <div className="mt-4">
                <a
                  href={`${INSURANCE_PORTAL}/dashboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline"
                >
                  View on InsureCo Portal →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Extraction Log */}
        <ExtractionLog claimId={id} />

      </div>
    </div>
  );
}
