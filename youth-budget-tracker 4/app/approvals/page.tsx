'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getReceiptSignedUrl } from '@/lib/supabase'

type PendingExpense = {
  id: string
  amount: number
  expense_date: string
  notes: string | null
  receipt_url: string | null
  youth: { first_name: string; last_initial: string | null; residence: { name: string } | null } | null
  category: { id: string; name: string } | null
  logger: { full_name: string } | null
}

type Balance = {
  youth_id: string
  category_id: string
  period_start: string
  period_end: string
  allocated_amount: number
  remaining: number
}

export default function ApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [expenses, setExpenses] = useState<PendingExpense[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    const [{ data: expenseData }, { data: balanceData }] = await Promise.all([
      supabase
        .from('expenses')
        .select(
          `id, amount, expense_date, notes, receipt_url,
           youth:youth_id ( first_name, last_initial, residence:residence_id ( name ) ),
           category:category_id ( id, name ),
           logger:logged_by ( full_name )`
        )
        .eq('status', 'pending')
        .order('expense_date', { ascending: true }),
      supabase
        .from('budget_balances')
        .select('youth_id, category_id, period_start, period_end, allocated_amount, remaining'),
    ])

    setExpenses((expenseData as unknown as PendingExpense[]) ?? [])
    setBalances(balanceData ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'supervisor' && profile.role !== 'admin')) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      await loadPending()
      setLoading(false)
    }

    init()
  }, [router, loadPending])

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleDecision(expenseId: string, decision: 'approved' | 'rejected') {
    setBusyId(expenseId)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('expenses')
      .update({
        status: decision,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', expenseId)

    setBusyId(null)

    if (error) return showMessage('error', error.message)

    showMessage('success', decision === 'approved' ? 'Expense approved.' : 'Expense rejected.')
    loadPending()
  }

  async function handleViewReceipt(path: string) {
    try {
      const url = await getReceiptSignedUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      showMessage('error', 'Could not load receipt.')
    }
  }

  // Find the matching budget period for this expense, and compute
  // what remains BEFORE and AFTER approving — the "after" number is
  // what actually helps a supervisor decide.
  function getBalanceContext(exp: PendingExpense) {
    if (!exp.category) return null
    const match = balances.find(
      (b) =>
        b.category_id === exp.category!.id &&
        exp.expense_date >= b.period_start &&
        exp.expense_date <= b.period_end
    )
    if (!match) return null
    return {
      remainingBefore: match.remaining,
      remainingAfter: match.remaining - exp.amount,
      allocated: match.allocated_amount,
    }
  }

  const buttonClass =
    'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50'

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <h1 className="text-lg font-medium text-neutral-900">Supervisors only</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This screen is only available to supervisors and admins.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-medium text-neutral-900">Pending approvals ({expenses.length})</h1>

      {message && (
        <p
          role="status"
          className={`mt-4 text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}

      {expenses.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">Nothing waiting on approval right now.</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {expenses.map((exp) => {
          const balance = getBalanceContext(exp)
          const overBudget = balance !== null && balance.remainingAfter < 0

          return (
            <li key={exp.id} className="rounded-md border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {exp.youth?.first_name} {exp.youth?.last_initial ?? ''}
                    <span className="ml-2 font-normal text-neutral-500">
                      {exp.youth?.residence?.name}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {exp.category?.name} — ${exp.amount.toFixed(2)} on {exp.expense_date}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Logged by {exp.logger?.full_name ?? 'unknown'}
                  </p>
                  {exp.notes && <p className="mt-1 text-sm text-neutral-600">"{exp.notes}"</p>}
                  {balance && (
                    <p className={`mt-2 text-xs ${overBudget ? 'text-red-600' : 'text-neutral-500'}`}>
                      ${balance.remainingBefore.toFixed(2)} left of ${balance.allocated.toFixed(2)}
                      {' → '}
                      ${balance.remainingAfter.toFixed(2)} left if approved
                      {overBudget && ' (over budget)'}
                    </p>
                  )}
                </div>
                {exp.receipt_url && (
                  <button
                    onClick={() => handleViewReceipt(exp.receipt_url!)}
                    className="shrink-0 text-sm text-neutral-600 underline hover:text-neutral-900"
                  >
                    View receipt
                  </button>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleDecision(exp.id, 'approved')}
                  disabled={busyId === exp.id}
                  className={buttonClass + ' bg-neutral-900 text-white hover:bg-neutral-700'}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(exp.id, 'rejected')}
                  disabled={busyId === exp.id}
                  className={buttonClass + ' border border-neutral-300 text-neutral-700 hover:bg-neutral-100'}
                >
                  Reject
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
