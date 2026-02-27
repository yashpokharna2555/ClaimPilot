"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Car, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function AddVehiclePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    vin: "", plate: "", make: "", model: "", year: "", color: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, val: string) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/policy/vehicles`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, year: Number(form.year) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to add vehicle");
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add vehicle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-[#1a2b4a]">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f7fb]">
              <Car className="h-5 w-5 text-[#00b4d8]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#1a2b4a]">Add a Vehicle</h1>
              <p className="text-sm text-slate-500">Required before filing a claim</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">VIN</label>
              <Input
                value={form.vin}
                onChange={(e) => set("vin", e.target.value.toUpperCase())}
                placeholder="1HGCM82633A004352"
                maxLength={17}
                required
              />
              <p className="mt-1 text-xs text-slate-400">17-character Vehicle Identification Number — found on driver door jamb</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Make</label>
                <Input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Toyota" required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Model</label>
                <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Camry" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Year</label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  placeholder="2022"
                  min="1980"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Color</label>
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Silver" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">License Plate</label>
              <Input
                value={form.plate}
                onChange={(e) => set("plate", e.target.value.toUpperCase())}
                placeholder="7ABC123"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !form.vin || !form.make || !form.model || !form.year || !form.plate}
              className="w-full bg-[#1a2b4a] hover:bg-[#0f1d33] text-white"
            >
              {loading ? "Adding vehicle..." : "Add Vehicle & Continue"}
            </Button>
          </form>

          <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <strong>Note:</strong> Adding your first vehicle also creates your policy. You can add more vehicles from the dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
