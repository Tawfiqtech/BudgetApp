'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Youth = { id: string; first_name: string; last_initial: string | null }
type Category = { id: string; name: string; period_type: string }

export default function LogExpensePage() {
  const router = useRouter()
  const [youthList, setYouthList] = useState<Youth[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [loading, setLoading] = useState(true)

  const [youthId, setYouthId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Load the worker's caseload + their org's categories.
  // RLS handles the filtering — this query only ever returns
  // youth this worker is actually assigned to.
  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      setOrganizationId(profile?.organization_id ?? '')

      const { data: residenceAssignments } = await supabase
        .from('worker_residence_assignments')
        .select('residence_id')
        .eq('worker_id', user.id)
        .eq('active', true)

      const residenceIds = residenceAssignments?.map((r) => r.residence_id) ?? []

      const [{ data: youthData }, { data: categoryData }] = await Promise.all([
        residenceIds.length > 0
          ? supabase
              .from('youth')
              .select('id, first_name, last_initial')
              .in('residence_id', residenceIds)
              .eq('active', true)
          : Promise.resolve({ data: [] }),
        supabase.from('budget_categories').select('id, name, period_type'),
      ])

      setYouthList(youthData ?? [])
      setCategories(categoryData ?? [])
      setLoading(false)
    }

    loadData()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMessage('')

    try {
      let receiptPath: string | null = null

      if (receipt) {
        const fileExt = receipt.name.split('.').pop()
        // Path starts with organization_id so storage policies can
        // scope access by org — see storage-policies.sql.
        const filePath = `${organizationId}/${youthId}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receipt)

        if (uploadError) throw uploadError

        // The bucket is private, so we store the file's path, not a
        // URL — a real, working link only exists for a short window
        // and has to be generated fresh (via createSignedUrl) at the
        // moment someone actually views the receipt, e.g. in the
        // supervisor approval screen.
        receiptPath = filePath
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error: insertError } = await supabase.from('expenses').insert({
        youth_id: youthId,
        category_id: categoryId,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        notes: notes || null,
        receipt_url: receiptPath,
        logged_by: user?.id,
        // organization_id is intentionally omitted — the database
        // fills it in automatically via get_user_org_id(), so a
        // worker's browser can never send a spoofed value.
      })

      if (insertError) throw insertError

      setStatus('success')
      setAmount('')
      setNotes('')
      setReceipt(null)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <p className="text-sm text-neutral-500">Loading your caseload…</p>
      </main>
    )
  }

  if (youthList.length === 0) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <h1 className="text-lg font-medium text-neutral-900">No youth to show</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You're not currently assigned to any house, or there aren't any active youth there yet.
          Ask your supervisor to assign you to a house first.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-lg font-medium text-neutral-900">Log an expense</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="youth" className="block text-sm font-medium text-neutral-700">
            Youth
          </label>
          <select
            id="youth"
            required
            value={youthId}
            onChange={(e) => setYouthId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            <option value="">Select…</option>
            {youthList.map((y) => (
              <option key={y.id} value={y.id}>
                {y.first_name} {y.last_initial ?? ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-neutral-700">
            Category
          </label>
          <select
            id="category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.period_type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="amount" className="block text-sm font-medium text-neutral-700">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="date" className="block text-sm font-medium text-neutral-700">
              Date
            </label>
            <input
              id="date"
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="receipt" className="block text-sm font-medium text-neutral-700">
            Receipt photo
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-neutral-600"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        </div>

        {status === 'error' && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        {status === 'success' && (
          <p role="status" className="text-sm text-green-700">
            Expense logged — waiting on supervisor approval.
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Log expense'}
        </button>
      </form>
    </main>
  )
}
