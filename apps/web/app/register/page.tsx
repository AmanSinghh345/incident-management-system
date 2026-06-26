"use client";

import { useState, FormEvent } from "react";

interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldError {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<FieldError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const filledCount = [
    form.fullName,
    form.email,
    form.password,
    form.confirmPassword,
  ].filter(Boolean).length;

  const progressPct = Math.round((filledCount / 4) * 100);

  const validate = (): boolean => {
    const next: FieldError = {};
    if (!form.fullName.trim()) next.fullName = "Name is required.";
    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.password) {
      next.password = "Password is required.";
    } else if (form.password.length < 8) {
      next.password = "Minimum 8 characters.";
    }
    if (!form.confirmPassword) {
      next.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FieldError]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1400));
    setIsLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mx-auto">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-5 h-5 text-white"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-3">
              Account created
            </p>
            <h2 className="text-white text-xl font-light tracking-tight">
              Welcome, {form.fullName.split(" ")[0]}.
            </h2>
            <p className="text-[#6B6B6B] text-sm mt-2 leading-relaxed">
              Check your inbox to verify your email address before signing in.
            </p>
          </div>
          <a
            href="/login"
            className="inline-block text-white text-sm border border-white/20 px-6 py-2.5 hover:bg-white hover:text-[#0A0A0A] transition-colors duration-200"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left panel — brand / context */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-white" />
          <span className="text-white font-mono text-sm tracking-widest uppercase">
            hello user
          </span>
        </div>

        {/* Quote / tagline */}
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

        {/* Footer note */}
        <p className="text-[#3A3A3A] font-mono text-[10px] tracking-widest uppercase">
          &copy; {new Date().getFullYear()} PulseOps Inc.
        </p>
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
              New account
            </p>
            <h2 className="text-white text-2xl font-light tracking-tight">
              Create your workspace
            </h2>
          </div>

          {/* Progress hairline */}
          <div className="relative mb-10 h-px bg-white/[0.08]">
            <div
              className="absolute inset-y-0 left-0 bg-white transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Full name */}
            <Field
              label="Full name"
              name="fullName"
              type="text"
              value={form.fullName}
              placeholder="Jane Smith"
              error={errors.fullName}
              onChange={handleChange}
              autoComplete="name"
            />

            {/* Email */}
            <Field
              label="Work email"
              name="email"
              type="email"
              value={form.email}
              placeholder="jane@company.com"
              error={errors.email}
              onChange={handleChange}
              autoComplete="email"
            />

            {/* Password */}
            <Field
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              placeholder="Min. 8 characters"
              error={errors.password}
              onChange={handleChange}
              autoComplete="new-password"
              toggle={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />

            {/* Confirm password */}
            <Field
              label="Confirm password"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              placeholder="Repeat password"
              error={errors.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              toggle={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />

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
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </div>

            {/* Terms */}
            <p className="text-[#6B6B6B] text-[11px] leading-relaxed text-center">
              By continuing you agree to our{" "}
              <a href="/terms" className="text-white underline underline-offset-2 hover:no-underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-white underline underline-offset-2 hover:no-underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>

          {/* Sign in link */}
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex items-center justify-between">
            <p className="text-[#6B6B6B] text-xs">Already have an account?</p>
            <a
              href="/login"
              className="text-white text-xs font-mono tracking-wider uppercase border border-white/20 px-4 py-2
                hover:bg-white hover:text-[#0A0A0A] transition-colors duration-150"
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Field component ─────────────────────────────────────── */

interface FieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  toggle?: boolean;
  onToggle?: () => void;
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
  toggle,
  onToggle,
}: FieldProps) {
  const isPassword = onToggle !== undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]"
      >
        {label}
      </label>
      <div className="relative">
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
            px-3.5 ${isPassword ? "pr-10" : ""}
            border placeholder-[#3A3A3A]
            focus:outline-none focus:border-white/60
            transition-colors duration-150
            ${error ? "border-white/40" : "border-white/[0.1]"}
          `}
        />
        {isPassword && (
          <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            aria-label={toggle ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-white transition-colors"
          >
            {toggle ? (
              // Eye-off
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2.73 16.39 1 12a10.08 10.08 0 0 1 4.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c5 0 9.27 3.61 11 8a10.06 10.06 0 0 1-1.29 2.56" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // Eye
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="font-mono text-[10px] tracking-wider text-white/60">
          {error}
        </p>
      )}
    </div>
  );
}