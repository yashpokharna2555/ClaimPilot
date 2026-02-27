"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Car, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { Authorization: `Bearer ${token}` };
}

function laneBadgeColor(lane: string | null) {
  switch (lane) {
    case "SHOP_ESTIMATE": return "bg-green-100 text-green-700";
    case "TOW_REQUIRED": return "bg-red-100 text-red-700";
    case "HUMAN_ADJUSTER": return "bg-amber-100 text-amber-700";
    case "FRAUD_REVIEW": return "bg-purple-100 text-purple-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default function DashboardPage() {
  const [policy, setPolicy] = useState<{ plan: string; premium_monthly: number; deductible: number; status: string; vehicles: { vin: string; make: string; model: string; year: number; plate: string }[] } | null>(null);
  const [claims, setClaims] = useState<{ id: string; incident_type: string; status: string; filed_at: string; lane: string | null; coverage_score: number | null }[]>([]);

  useEffect(() => {
    fetch(`${API}/policy/me`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setPolicy(data))
      .catch(() => {});

    fetch(`${API}/claims`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => Array.isArray(data) && setClaims(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1a2b4a]">My Dashboard</h1>
          <Link href="/claims/new">
            <Button className="gap-2 bg-[#1a2b4a] hover:bg-[#0f1d33] text-white">
              <Plus className="h-4 w-4" /> File a Claim
            </Button>
          </Link>
        </div>

        {/* Policy Card */}
        {policy && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active Policy</p>
                <p className="mt-1 text-xl font-semibold capitalize text-[#1a2b4a]">{policy.plan} Plan</p>
              </div>
              <Badge className={policy.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                {policy.status}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Monthly Premium</p>
                <p className="text-lg font-semibold text-slate-800">${policy.premium_monthly}/mo</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Deductible</p>
                <p className="text-lg font-semibold text-slate-800">${policy.deductible}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vehicles</p>
                <p className="text-lg font-semibold text-slate-800">{policy.vehicles.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Vehicles */}
        {policy && policy.vehicles.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1a2b4a]">Vehicles</h2>
              <Link href="/policy/vehicles" className="text-sm text-[#00b4d8] hover:underline">
                + Add Vehicle
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {policy.vehicles.map((v) => (
                <div key={v.vin} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f7fb]">
                    <Car className="h-5 w-5 text-[#00b4d8]" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{v.year} {v.make} {v.model}</p>
                    <p className="text-sm text-slate-400">Plate: {v.plate} · VIN: ···{v.vin.slice(-4)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claims List */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#1a2b4a]">Claims</h2>
          {claims.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-500">No claims yet</p>
              <Link href="/claims/new" className="mt-4">
                <Button size="sm" className="bg-[#1a2b4a] text-white">File your first claim</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {claims.map((c) => (
                <Link key={c.id} href={`/claims/${c.id}`}>
                  <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-[#00b4d8] transition-all">
                    <div>
                      <p className="font-medium capitalize text-slate-800">{c.incident_type.replace("_", " ")}</p>
                      <p className="text-sm text-slate-400">{new Date(c.filed_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.lane && (
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${laneBadgeColor(c.lane)}`}>
                          {c.lane.replace("_", " ")}
                        </span>
                      )}
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        c.status === "complete" ? "bg-green-100 text-green-700" :
                        c.status === "processing" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{c.status}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
