'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = { id: string; full_name: string; role: string; organization_id: string }
type Residence = { id: string; name: string }
type Youth = { id: string; first_name: string; last_initial: string | null; residence_id: string | null }
type Category = { id: string; name: string; period_type: string; default_amount: number }
type Worker = { id: string; full_name: string }
type Assignment = {
  id: string
  residence: { name: string } | null
  worker: { full_name: string } | null
}

export default function AdminPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const [youthList, setYouthList] = useState<Youth[]>([])
  const [residences, setResidences] = useState<Residence[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])

  // ---- form state ----
  const [newResidenceName, setNewResidenceName] = useState('')

  const [newYouthFirst, setNewYouthFirst] = useState('')
  const [newYouthLast, setNewYouthLast] = useState('')
  const [newYouthExternalId, setNewYouthExternalId] = useState('')
  const [newYouthResidenceId, setNewYouthResidenceId] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryPeriod, setNewCategoryPeriod] = useState<'weekly' | 'monthly'>('monthly')
  const [newCategoryAmount, setNewCategoryAmount] = useState('')

  const [assignWorkerId, setAssignWorkerId] = useState('')
  const [assignResidenceId, setAssignResidenceId] = useState('')

  const [allocationYouthId, setAllocationYouthId] = useState('')
  const [allocationCategoryId, setAllocationCategoryId] = useState('')
  const [allocationAmount, setAllocationAmount] = useState('')
  const [allocationStart, setAllocationStart] = useState('')
  const [allocationEnd, setAllocationEnd] = useState('')

  const [inviteRole, setInviteRole] = useState<'worker' | 'supervisor' | 'admin'>('worker')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadAll = useCallback(async (orgId: string) => {
    const [{ data: org }, { data: residenceData }, { data: youthData }, { data: categoryData }, { data: workerData }, { data: assignmentData }] =
      await Promise.all([
        supabase.from('organizations').select('name').eq('id', orgId).single(),
        supabase.from('residences').select('id, name').order('name'),
        supabase.from('youth').select('id, first_name, last_initial, residence_id').order('first_name'),
        supabase.from('budget_categories').select('id, name, period_type, default_amount').order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'worker').order('full_name'),
        supabase
          .from('worker_residence_assignments')
          .select('id, active, residence:residence_id (name), worker:worker_id (full_name)')
          .eq('active', true),
      ])

    setOrgName(org?.name ?? '')
    setResidences(residenceData ?? [])
    setYouthList(youthData ?? [])
    setCategories(categoryData ?? [])
    setWorkers(workerData ?? [])
    setAssignments((assignmentData as unknown as Assignment[]) ?? [])
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, role, organization_id')
        .eq('id', user.id)
        .single()

      if (!profileData || profileData.role !== 'admin') {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      setProfile(profileData)
      await loadAll(profileData.organization_id)
      setLoading(false)
    }

    init()
  }, [router, loadAll])

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleAddResidence(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('residences').insert({ name: newResidenceName })
    if (error) return showMessage('error', error.message)
    setNewResidenceName('')
    showMessage('success', 'House added.')
    if (profile) loadAll(profile.organization_id)
  }

  async function handleAddYouth(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('youth').insert({
      first_name: newYouthFirst,
      last_initial: newYouthLast || null,
      external_id: newYouthExternalId || null,
      residence_id: newYouthResidenceId || null,
    })
    if (error) return showMessage('error', error.message)
    setNewYouthFirst('')
    setNewYouthLast('')
    setNewYouthExternalId('')
    setNewYouthResidenceId('')
    showMessage('success', 'Youth added.')
    if (profile) loadAll(profile.organization_id)
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('budget_categories').insert({
      name: newCategoryName,
      period_type: newCategoryPeriod,
      default_amount: parseFloat(newCategoryAmount) || 0,
    })
    if (error) return showMessage('error', error.message)
    setNewCategoryName('')
    setNewCategoryAmount('')
    showMessage('success', 'Category added.')
    if (profile) loadAll(profile.organization_id)
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('worker_residence_assignments').insert({
      worker_id: assignWorkerId,
      residence_id: assignResidenceId,
      active: true,
    })
    if (error) return showMessage('error', error.message)
    setAssignResidenceId('')
    setAssignWorkerId('')
    showMessage('success', 'Worker assigned to house.')
    if (profile) loadAll(profile.organization_id)
  }

  async function handleAddAllocation(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('budget_allocations').insert({
      youth_id: allocationYouthId,
      category_id: allocationCategoryId,
      allocated_amount: parseFloat(allocationAmount),
      period_start: allocationStart,
      period_end: allocationEnd,
    })
    if (error) return showMessage('error', error.message)
    setAllocationYouthId('')
    setAllocationCategoryId('')
    setAllocationAmount('')
    setAllocationStart('')
    setAllocationEnd('')
    showMessage('success', 'Budget allocation set.')
  }

  function generateInviteLink() {
    if (!profile) return
    const url = `${window.location.origin}/signup?org=${profile.organization_id}&orgName=${encodeURIComponent(
      orgName
    )}&role=${inviteRole}`
    setInviteLink(url)
    setCopied(false)
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'
  const labelClass = 'block text-sm font-medium text-neutral-700'
  const buttonClass =
    'mt-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50'

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
        <h1 className="text-lg font-medium text-neutral-900">Admins only</h1>
        <p className="mt-2 text-sm text-neutral-600">
          This screen is only available to organization admins.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-medium text-neutral-900">Admin — {orgName}</h1>

      {message && (
        <p
          role="status"
          className={`mt-4 text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}

      {/* INVITE LINK */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Invite staff</h2>
        <div className="mt-3 flex gap-2">
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
            className={inputClass + ' flex-1'}
          >
            <option value="worker">Worker</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={generateInviteLink} className={buttonClass}>
            Generate link
          </button>
        </div>
        {inviteLink && (
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={inviteLink} className={inputClass + ' flex-1 text-neutral-500'} />
            <button onClick={copyInviteLink} className={buttonClass}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      {/* RESIDENCES */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Houses ({residences.length})</h2>
        <form onSubmit={handleAddResidence} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>House name</label>
            <input required placeholder="e.g. Bear House" value={newResidenceName} onChange={(e) => setNewResidenceName(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className={buttonClass}>Add house</button>
        </form>
        <ul className="mt-3 text-sm text-neutral-600">
          {residences.map((r) => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ul>
      </section>

      {/* YOUTH */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Youth ({youthList.length})</h2>
        <form onSubmit={handleAddYouth} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>First name</label>
            <input required value={newYouthFirst} onChange={(e) => setNewYouthFirst(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Last initial</label>
            <input value={newYouthLast} onChange={(e) => setNewYouthLast(e.target.value)} maxLength={1} className={inputClass + ' w-16'} />
          </div>
          <div>
            <label className={labelClass}>House</label>
            <select required value={newYouthResidenceId} onChange={(e) => setNewYouthResidenceId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {residences.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Case system ID (optional)</label>
            <input value={newYouthExternalId} onChange={(e) => setNewYouthExternalId(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className={buttonClass}>Add youth</button>
        </form>
        <ul className="mt-3 text-sm text-neutral-600">
          {youthList.map((y) => (
            <li key={y.id}>
              {y.first_name} {y.last_initial ?? ''} — {residences.find((r) => r.id === y.residence_id)?.name ?? 'no house set'}
            </li>
          ))}
        </ul>
      </section>

      {/* CATEGORIES */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Budget categories ({categories.length})</h2>
        <form onSubmit={handleAddCategory} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Name</label>
            <input required value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period</label>
            <select value={newCategoryPeriod} onChange={(e) => setNewCategoryPeriod(e.target.value as 'weekly' | 'monthly')} className={inputClass}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Default amount</label>
            <input type="number" step="0.01" required value={newCategoryAmount} onChange={(e) => setNewCategoryAmount(e.target.value)} className={inputClass + ' w-28'} />
          </div>
          <button type="submit" className={buttonClass}>Add category</button>
        </form>
        <ul className="mt-3 text-sm text-neutral-600">
          {categories.map((c) => (
            <li key={c.id}>{c.name} — {c.period_type} — ${c.default_amount}</li>
          ))}
        </ul>
      </section>

      {/* ASSIGNMENTS */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-900">Assign worker to a house</h2>
        <form onSubmit={handleAssign} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Worker</label>
            <select required value={assignWorkerId} onChange={(e) => setAssignWorkerId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>House</label>
            <select required value={assignResidenceId} onChange={(e) => setAssignResidenceId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {residences.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button type="submit" className={buttonClass}>Assign</button>
        </form>
        <ul className="mt-3 text-sm text-neutral-600">
          {assignments.map((a) => (
            <li key={a.id}>{a.worker?.full_name ?? '—'} → {a.residence?.name ?? '—'}</li>
          ))}
        </ul>
      </section>

      {/* ALLOCATIONS */}
      <section className="mt-8 border-t border-neutral-200 pt-6 pb-10">
        <h2 className="text-sm font-semibold text-neutral-900">Set a budget allocation</h2>
        <form onSubmit={handleAddAllocation} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Youth</label>
            <select required value={allocationYouthId} onChange={(e) => setAllocationYouthId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {youthList.map((y) => <option key={y.id} value={y.id}>{y.first_name} {y.last_initial ?? ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select required value={allocationCategoryId} onChange={(e) => setAllocationCategoryId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" required value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} className={inputClass + ' w-24'} />
          </div>
          <div>
            <label className={labelClass}>Period start</label>
            <input type="date" required value={allocationStart} onChange={(e) => setAllocationStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period end</label>
            <input type="date" required value={allocationEnd} onChange={(e) => setAllocationEnd(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className={buttonClass}>Set allocation</button>
        </form>
      </section>
    </main>
  )
}
