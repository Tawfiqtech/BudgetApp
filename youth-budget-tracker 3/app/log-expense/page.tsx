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

      const [{ data: assignments }, { data: categoryData }] = await Promise.all([
        supabase
          .from('youth_assignments')
          .select('youth:youth_id (id, first_name, last_initial)')
          .eq('active', true),
        supabase.from('budget_categories').select('id, name, period_type'),
      ])

      const youthFromAssignments =
        assignments?.map((a) => a.youth).filter(Boolean) ?? []

      setYouthList(youthFromAssignments as unknown as Youth[])
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
      let receiptUrl: string | null = null

      if (receipt) {
        const fileExt = receipt.name.split('.').pop()
        const filePath = `${youthId}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receipt)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath)

        receiptUrl = publicUrlData.publicUrl
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
        receipt_url: receiptUrl,
        logged_by: user?.id,
        // organization_id is intentionally omitted — set this via a
        // Postgres trigger/default that reads it from the logged-in
        // user's profile, so a worker can never spoof another org's ID.
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
        <h1 className="text-lg font-medium text-neutral-900">No youth assigned yet</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You don't have any active youth on your caseload. Ask your supervisor to assign one
          before logging an expense.
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
