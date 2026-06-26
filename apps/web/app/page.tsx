import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-signal">
          PulseOps
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight text-ink">
          Real-time incident management for teams that need clear service status.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Monitor URLs, detect failures, create incidents, alert teammates, and
          keep dashboards updated in real time.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-signal px-5 py-3 text-sm font-semibold text-white"
          >
            Open Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-ink"
          >
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
