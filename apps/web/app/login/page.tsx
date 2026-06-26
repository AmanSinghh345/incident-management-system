"use client";

import { useState, FormEvent } from "react";

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface FieldError {
  email?: string;
  password?: string;
  form?: string;
}

export default function LoginPage() {
  const [form, setForm] = useState<LoginForm>({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState<FieldError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const next: FieldError = {};
    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.password) {
      next.password = "Password is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name as keyof FieldError]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    // Simulate API call — replace with your auth logic
    await new Promise((r) => setTimeout(r, 1400));
    setIsLoading(false);
    // Simulate wrong credentials for demo
    setErrors({ form: "Incorrect email or password." });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-white" />
          <span className="text-white font-mono text-sm tracking-widest uppercase">
            PulseOps
          </span>
        </div>

        {/* Tagline */}
        <div className="space-y-6">
          <p className="text-[#6B6B6B] font-mono text-[10px] tracking-[0.25em] uppercase">
            Operational clarity
          </p>
          <h1 className="text-white text-4xl font-light leading-[1.15] tracking-tight">
            Every metric.
            <br />
            Every signal.
            <br />
            <span className="text-[#6B6B6B]">One surface.</span>
          </h1>
        </div>

        {/* Recent activity ticker — decorative */}
        <div className="space-y-3">
          {[
            { time: "2m ago", msg: "Deploy pipeline completed" },
            { time: "11m ago", msg: "Alert resolved — API latency" },
            { time: "1h ago", msg: "Weekly digest sent" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-[#3A3A3A] w-14 shrink-0">
                {item.time}
              </span>
              <div className="w-1 h-1 rounded-full bg-[#3A3A3A] shrink-0" />
              <span className="text-[#6B6B6B] text-[11px]">{item.msg}</span>
            </div>
          ))}
          <p className="text-[#2A2A2A] font-mono text-[10px] tracking-widest uppercase pt-4">
            &copy; {new Date().getFullYear()} PulseOps Inc.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-12 lg:hidden">
            <div className="w-5 h-5 bg-white" />
            <span className="text-white font-mono text-xs tracking-widest uppercase">
              PulseOps
            </span>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#6B6B6B] mb-3">
              Welcome back
            </p>
            <h2 className="text-white text-2xl font-light tracking-tight">
              Sign in to your workspace
            </h2>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mb-10" />

          {/* Form-level error */}
          {errors.form && (
            <div className="mb-6 flex items-center gap-3 border border-white/[0.12] px-4 py-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-4 h-4 text-white/40 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="font-mono text-[10px] tracking-wider text-white/60">
                {errors.form}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <Field
              label="Email address"
              name="email"
              type="email"
              value={form.email}
              placeholder="jane@company.com"
              error={errors.email}
              onChange={handleChange}
              autoComplete="email"
            />

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]"
                >
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="font-mono text-[10px] tracking-wider text-[#6B6B6B] hover:text-white transition-colors duration-150 uppercase"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="Your password"
                  onChange={handleChange}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={`
                    w-full h-11 bg-[#1A1A1A] text-white text-sm
                    px-3.5 pr-10
                    border placeholder-[#3A3A3A]
                    focus:outline-none focus:border-white/60
                    transition-colors duration-150
                    ${errors.password ? "border-white/40" : "border-white/[0.1]"}
                  `}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2.73 16.39 1 12a10.08 10.08 0 0 1 4.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c5 0 9.27 3.61 11 8a10.06 10.06 0 0 1-1.29 2.56" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="font-mono text-[10px] tracking-wider text-white/60">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={form.remember}
                onClick={() => setForm((p) => ({ ...p, remember: !p.remember }))}
                className={`
                  w-4 h-4 border shrink-0 flex items-center justify-center
                  transition-colors duration-150
                  ${form.remember
                    ? "bg-white border-white"
                    : "bg-transparent border-white/20 hover:border-white/40"
                  }
                `}
              >
                {form.remember && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5 text-[#0A0A0A]">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#6B6B6B]">
                Stay signed in for 30 days
              </span>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-white text-[#0A0A0A] font-mono text-xs tracking-[0.15em] uppercase
                  hover:bg-[#F5F5F5] active:bg-[#E0E0E0]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

            {/* SSO divider */}
            <div className="relative flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3A3A3A]">
                or
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* SSO button */}
            <button
              type="button"
              className="w-full h-11 bg-transparent border border-white/[0.1] text-white font-mono text-xs tracking-[0.15em] uppercase
                hover:border-white/30 hover:bg-white/[0.03]
                transition-colors duration-150 flex items-center justify-center gap-2.5"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[#6B6B6B]">
                <rect x="3" y="11" width="18" height="11" rx="0" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Continue with SSO
            </button>
          </form>

          {/* Register link */}
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex items-center justify-between">
            <p className="text-[#6B6B6B] text-xs">Don't have an account?</p>
            <a
              href="/register"
              className="text-white text-xs font-mono tracking-wider uppercase border border-white/20 px-4 py-2
                hover:bg-white hover:text-[#0A0A0A] transition-colors duration-150"
            >
              Register
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable Field ─────────────────────────────────────── */

interface FieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}

function Field({
  label,
  name,
  type,
  value,
  placeholder,
  error,
  onChange,
  autoComplete,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`
          w-full h-11 bg-[#1A1A1A] text-white text-sm
          px-3.5
          border placeholder-[#3A3A3A]
          focus:outline-none focus:border-white/60
          transition-colors duration-150
          ${error ? "border-white/40" : "border-white/[0.1]"}
        `}
      />
      {error && (
        <p id={`${name}-error`} className="font-mono text-[10px] tracking-wider text-white/60">
          {error}
        </p>
      )}
    </div>
  );
}