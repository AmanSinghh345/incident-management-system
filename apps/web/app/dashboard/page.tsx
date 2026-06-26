export default function DashboardPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-ink">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Monitor uptime, active incidents, and recent checks will appear here.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Active monitors", "Open incidents", "Recent checks"].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{item}</p>
              <p className="mt-4 text-3xl font-semibold text-ink">--</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
