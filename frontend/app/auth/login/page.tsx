"use client";

import Link from "next/link";
import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Login failed");
      }
      const { access_token, refresh_token } = await res.json();
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a2b4a]">
            <Shield className="h-7 w-7 text-[#00b4d8]" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#1a2b4a]">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your SwiftSettle account</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="flex justify-end">
            <Link href="/auth/forgot-password" className="text-sm text-[#00b4d8] hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full bg-[#1a2b4a] hover:bg-[#0f1d33] text-white" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-[#00b4d8] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
