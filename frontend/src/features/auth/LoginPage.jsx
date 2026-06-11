import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useAuth } from "./AuthContext.jsx";

const highlights = [
  "Role based dashboards",
  "Rent balances and arrears",
  "Caretaker payment follow-up",
  "Kenya-ready property workflows",
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      setError("Login failed. Check your email and password, then try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-950 lg:grid lg:grid-cols-[1fr_500px]">
      <section className="relative hidden overflow-hidden px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,197,94,0.32),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(14,165,233,0.18),transparent_26%),linear-gradient(135deg,#020617_0%,#0f2f2d_48%,#0d593c_100%)]" />
        <div className="absolute inset-x-10 top-20 h-px bg-white/15" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute bottom-28 right-28 h-32 w-32 rounded-full border border-white/10" />

        <div className="relative">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Kenya Rental OS
          </div>
          <h1 className="mt-8 max-w-2xl text-5xl font-semibold leading-tight">
            Run properties, payments, tenants, and field operations from one secure workspace.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
            A modern rental management workspace for Kenyan landlords, property managers,
            finance teams, and field staff.
          </p>

          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3">
            {highlights.map((item) => (
              <div key={item} className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-slate-100 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="mb-6 max-w-xl rounded-md border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-sm text-brand-100">Today&apos;s collections</div>
                <div className="mt-1 text-3xl font-semibold">Ksh 184,500</div>
              </div>
              <div className="rounded-full bg-emerald-300/20 px-3 py-1 text-sm font-semibold text-emerald-100">
                Live
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-slate-300">Paid</div>
                <div className="mt-1 text-xl font-semibold">42</div>
              </div>
              <div>
                <div className="text-slate-300">Partial</div>
                <div className="mt-1 text-xl font-semibold">8</div>
              </div>
              <div>
                <div className="text-slate-300">Overdue</div>
                <div className="mt-1 text-xl font-semibold">5</div>
              </div>
            </div>
          </div>
          <div className="grid max-w-2xl grid-cols-3 gap-4 text-sm">
            <div className="rounded-md border border-white/15 bg-white/10 p-4">
            <div className="text-3xl font-semibold">98%</div>
            <div className="mt-2 text-brand-50">Collection visibility</div>
          </div>
            <div className="rounded-md border border-white/15 bg-white/10 p-4">
              <div className="text-3xl font-semibold">24/7</div>
            <div className="mt-2 text-brand-50">Tenant records</div>
          </div>
            <div className="rounded-md border border-white/15 bg-white/10 p-4">
              <div className="text-3xl font-semibold">4</div>
            <div className="mt-2 text-brand-50">Role types</div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-5 py-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-soft">
          <div>
            <div className="mb-6 inline-flex rounded-md bg-brand-600 px-4 py-3 text-white">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-100">RMS</div>
                <div className="text-xl font-semibold">Rental Manager</div>
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Sign in to your workspace</h2>
            <p className="mt-2 text-sm text-slate-600">
              Access property records, rent balances, payment workflows, and reports.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <TextInput
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              onClick={() => setResetMessage("Password reset will be sent by the system owner/landlord in this release. Passwords are never stored in plain text.")}
            >
              Forgot password?
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {resetMessage ? (
            <div className="mt-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
              {resetMessage}
            </div>
          ) : null}

          <Button type="submit" className="mt-6 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>

          <div className="mt-6 border-t border-slate-200 pt-5 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Powered by</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Teqnovation Softwares</p>
          </div>
        </form>
      </section>
    </main>
  );
}
