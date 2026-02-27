"use client";

import Link from "next/link";
import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production: call POST /auth/forgot-password
    setSent(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a2b4a]">
            <Shield className="h-7 w-7 text-[#00b4d8]" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#1a2b4a]">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-4xl">✉️</div>
            <p className="mt-4 font-medium text-[#1a2b4a]">Check your inbox</p>
            <p className="mt-2 text-sm text-slate-500">We sent a reset link to <strong>{email}</strong>.</p>
            <Link href="/auth/login">
              <Button variant="link" className="mt-4 text-[#00b4d8]">Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <Button type="submit" className="w-full bg-[#1a2b4a] hover:bg-[#0f1d33] text-white">
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
