'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Expects an invite link shaped like:
//   /signup?org=<organization_id>&orgName=Sunrise+Youth+Services&role=worker
// An admin generates this link (or n8n emails it) when inviting staff.
//
// useSearchParams() requires a Suspense boundary around it for Next.js
// to statically prerender this page, so the actual form lives in its
// own component (SignupForm) and this file's default export just
// wraps it in <Suspense>.
function SignupForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const organizationId = searchParams.get('org')
  const orgName = searchParams.get('orgName') ?? 'your organization'
  const role = searchParams.get('role') ?? 'worker'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const missingInvite = !organizationId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (missingInvite) return

    setStatus('loading')
    setErrorMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          organization_id: organizationId,
          role,
          full_name: fullName,
        },
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    setStatus('success')
  }

  if (missingInvite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-lg font-medium text-neutral-900">Invite link needed</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This page only works from an invite link sent by your organization's admin.
          Ask them to resend it if you don't have one.
        </p>
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-lg font-medium text-neutral-900">Check your email</h1>
        <p className="mt-2 text-sm text-neutral-600">
          We sent a confirmation link to {email}. Confirm it, then log in to get started.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-lg font-medium text-neutral-900">Join {orgName}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        You've been invited as a {role}. Set up your account below.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        {status === 'error' && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
          <p className="text-sm text-neutral-500">Loading…</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
