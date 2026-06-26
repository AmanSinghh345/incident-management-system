import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-ink">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Registration API integration will be added after the backend auth module.
        </p>
        <form className="mt-6 space-y-4">
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Name" />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Email" />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Password" type="password" />
          <button className="w-full rounded-md bg-signal px-4 py-2 font-semibold text-white" type="button">
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already registered? <Link className="font-semibold text-signal" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
