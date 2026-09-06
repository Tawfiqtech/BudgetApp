import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-lg font-medium text-neutral-900">Youth Budget Tracker</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Log in to log an expense, or use the invite link from your organization to sign up.
      </p>
      <Link
        href="/login"
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-neutral-700"
      >
        Log in
      </Link>
    </main>
  )
}
