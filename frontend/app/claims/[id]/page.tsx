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
  const [submission, setSubmission] = useState<{ status: string; confirmation_id: string | null } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  useEffect(() => {
    if (!id) return;

    fetch(`${API}/claims/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setClaim);

    fetch(`${API}/claims/${id}/evidence`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((b) => setClips(b.clips ?? []));

    fetch(`${API}/claims/${id}/routing`, { headers: authHeaders() })
      .then((r) => r.status === 202 ? null : r.json())
      .then((data) => data && setRouting(data));

    fetch(`${API}/claims/${id}/submission`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setSubmission(data));

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
    });
    return () => es.close();
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

          {laneConfig && (
            <div className="mt-6">
              <Button className={`w-full ${lane === "SHOP_ESTIMATE" ? "bg-[#1a2b4a]" : "bg-amber-600"} text-white`}>
                {laneConfig.action}
              </Button>
              <p className="mt-2 text-center text-xs text-slate-400">
                This will log into InsureCo and file the claim automatically.
              </p>
            </div>
          )}
        </div>

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
            <h2 className="text-lg font-semibold text-[#1a2b4a]">Submission Status</h2>
            <div className="mt-3 flex items-center gap-3">
              <Badge className={
                submission.status === "succeeded" ? "bg-green-100 text-green-700" :
                submission.status === "failed" ? "bg-red-100 text-red-700" :
                "bg-blue-100 text-blue-700"
              }>
                {submission.status}
              </Badge>
              {submission.confirmation_id && (
                <span className="font-mono text-sm text-slate-600">Ref: {submission.confirmation_id}</span>
              )}
            </div>
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
