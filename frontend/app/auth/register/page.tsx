"use client";

import Link from "next/link";
import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", license_state: "", password: "",
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
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Registration failed");
      }
      const { access_token, refresh_token } = await res.json();
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a2b4a]">
            <Shield className="h-7 w-7 text-[#00b4d8]" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#1a2b4a]">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Start filing claims in minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="555-0100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">License State</label>
              <Input value={form.license_state} onChange={(e) => set("license_state", e.target.value)} placeholder="CA" maxLength={2} required />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" minLength={8} required />
          </div>

          <Button type="submit" className="w-full bg-[#1a2b4a] hover:bg-[#0f1d33] text-white" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-xs text-slate-400">
            By creating an account, you agree to our{" "}
            <Link href="#" className="text-[#00b4d8] hover:underline">Terms of Service</Link>{" "}
            and{" "}
            <Link href="#" className="text-[#00b4d8] hover:underline">Privacy Policy</Link>.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-[#00b4d8] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
