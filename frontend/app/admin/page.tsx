"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type ClaimRow = {
  id: string;
  incident_type: string;
  status: string;
  filed_at: string;
  lane: string | null;
  coverage_score: number | null;
  fraud_risk: string | null;
  user_email: string;
};

const LANE_COLORS: Record<string, string> = {
  SHOP_ESTIMATE: "bg-green-100 text-green-700",
  TOW_REQUIRED: "bg-red-100 text-red-700",
  HUMAN_ADJUSTER: "bg-amber-100 text-amber-700",
  FRAUD_REVIEW: "bg-purple-100 text-purple-700",
};

const FRAUD_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

const ADAPTER_TYPES = ["collision", "hail", "glass_only", "tow_risk"];

export default function AdminPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [laneFilter, setLaneFilter] = useState("");
  const [fraudFilter, setFraudFilter] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, { final_lane: string; final_severity: string; adjuster_notes: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [training, setTraining] = useState<string | null>(null);
  const [trainMsg, setTrainMsg] = useState("");

  const PAGE_SIZE = 20;

  useEffect(() => {
    const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
    if (statusFilter) params.set("status", statusFilter);
    if (laneFilter) params.set("lane", laneFilter);
    if (fraudFilter) params.set("fraud_risk", fraudFilter);

    fetch(`${API}/admin/claims?${params}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setClaims(data.claims ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, [statusFilter, laneFilter, fraudFilter, page]);

  function setOutcomeField(id: string, field: string, val: string) {
    setOutcomes((prev) => ({
      ...prev,
      [id]: { ...prev[id], final_lane: "", final_severity: "", adjuster_notes: "", [field]: val },
    }));
  }

  async function saveOutcome(id: string) {
    const outcome = outcomes[id];
    if (!outcome?.final_lane) return;
    setSaving(id);
    try {
      await fetch(`${API}/admin/claims/${id}/outcome`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(outcome),
      });
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "resolved" } : c))
      );
      setExpandedId(null);
    } finally {
      setSaving(null);
    }
  }

  async function triggerTraining(adapter: string) {
    setTraining(adapter);
    setTrainMsg("");
    try {
      const res = await fetch(`${API}/admin/train/${adapter}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ num_epochs: 10 }),
      });
      const data = await res.json();
      setTrainMsg(data.message ?? "Training queued");
    } catch {
      setTrainMsg("Failed to start training job");
    } finally {
      setTraining(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a2b4a]">Adjuster Portal</h1>
            <p className="text-sm text-slate-400">{total} claims total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="complete">Complete</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={laneFilter}
            onChange={(e) => { setLaneFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
          >
            <option value="">All lanes</option>
            <option value="SHOP_ESTIMATE">Shop Estimate</option>
            <option value="TOW_REQUIRED">Tow Required</option>
            <option value="HUMAN_ADJUSTER">Human Adjuster</option>
            <option value="FRAUD_REVIEW">Fraud Review</option>
          </select>
          <select
            value={fraudFilter}
            onChange={(e) => { setFraudFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
          >
            <option value="">All fraud risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Claims Table */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {["Claim ID", "User", "Incident", "Filed", "Score", "Lane", "Fraud", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <>
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.user_email}</td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-700">{c.incident_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(c.filed_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#1a2b4a]">{c.coverage_score ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.lane ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LANE_COLORS[c.lane] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.lane.replace(/_/g, " ")}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.fraud_risk ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FRAUD_COLORS[c.fraud_risk] ?? "bg-slate-100"}`}>
                          {c.fraud_risk}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "complete" ? "bg-green-100 text-green-700" :
                        c.status === "processing" ? "bg-blue-100 text-blue-700" :
                        c.status === "resolved" ? "bg-slate-100 text-slate-500" :
                        "bg-amber-100 text-amber-700"
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-[#00b4d8] hover:text-[#0099bb]"
                      >
                        {expandedId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Outcome Form */}
                  {expandedId === c.id && (
                    <tr key={`${c.id}-expand`}>
                      <td colSpan={9} className="bg-slate-50 px-6 py-5">
                        <p className="mb-4 text-sm font-semibold text-[#1a2b4a]">Label Outcome</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Final Lane</label>
                            <select
                              value={outcomes[c.id]?.final_lane ?? ""}
                              onChange={(e) => setOutcomeField(c.id, "final_lane", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
                            >
                              <option value="">Select lane</option>
                              <option value="SHOP_ESTIMATE">Shop Estimate</option>
                              <option value="TOW_REQUIRED">Tow Required</option>
                              <option value="HUMAN_ADJUSTER">Human Adjuster</option>
                              <option value="FRAUD_REVIEW">Fraud Review</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Final Severity</label>
                            <select
                              value={outcomes[c.id]?.final_severity ?? ""}
                              onChange={(e) => setOutcomeField(c.id, "final_severity", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
                            >
                              <option value="">Select severity</option>
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                              <option value="total_loss">Total Loss</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Adjuster Notes</label>
                            <input
                              type="text"
                              value={outcomes[c.id]?.adjuster_notes ?? ""}
                              onChange={(e) => setOutcomeField(c.id, "adjuster_notes", e.target.value)}
                              placeholder="Optional notes..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <Button
                            onClick={() => saveOutcome(c.id)}
                            disabled={!outcomes[c.id]?.final_lane || saving === c.id}
                            className="bg-[#1a2b4a] text-white"
                          >
                            {saving === c.id ? "Saving..." : "Save Outcome"}
                          </Button>
                          <Button variant="outline" onClick={() => setExpandedId(null)}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}

              {claims.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                    No claims match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}

        {/* Adapter Training */}
        <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-[#00b4d8]" />
            <h2 className="text-lg font-semibold text-[#1a2b4a]">Train LoRA Adapters</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Trigger local fine-tuning from accumulated JSONL training examples.
            Each adapter is ~5MB and improves routing accuracy for its incident type.
          </p>
          {trainMsg && (
            <div className="mt-3 rounded-lg bg-[#e8f7fb] px-4 py-3 text-sm text-[#1a2b4a]">
              {trainMsg}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {ADAPTER_TYPES.map((adapter) => (
              <Button
                key={adapter}
                variant="outline"
                onClick={() => triggerTraining(adapter)}
                disabled={training === adapter}
                className="capitalize"
              >
                {training === adapter ? (
                  <><Cpu className="mr-2 h-4 w-4 animate-spin" /> Training...</>
                ) : (
                  `Train ${adapter.replace(/_/g, " ")}`
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Status Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> SHOP_ESTIMATE — auto-submit to repair portal</div>
          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> HUMAN_ADJUSTER — requires review</div>
          <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> TOW_REQUIRED — dispatch tow</div>
          <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-purple-500" /> FRAUD_REVIEW — escalate to SIU</div>
        </div>
      </div>
    </div>
  );
}
