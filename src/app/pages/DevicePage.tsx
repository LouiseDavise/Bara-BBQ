// /device: a branch manager registers this browser (POS tablet, KDS screen, host stand) to a branch.
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { pickText } from '../../../shared/localized'
import { fill } from '../../i18n/types'
import { api, ApiError } from '../../lib/api'
import { useI18n, useSession } from '../context'
import type { BranchContext, MeResponse } from '../types'
import { Button, Field, Notice, SelectField } from '../ui'
import { StaffHeader } from './StaffHeader'

const KINDS = ['pos', 'kds', 'host', 'waiter'] as const
type Kind = (typeof KINDS)[number]

export function DevicePage({ me }: { me: MeResponse }) {
  const { m, locale } = useI18n()
  const { refresh } = useSession()
  const managed = me.user.branches.filter((b) => b.role === 'manager' || b.role === 'owner' || b.role === 'area')
  const [branchId, setBranchId] = useState(managed[0]?.id ?? '')
  const [context, setContext] = useState<BranchContext | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('pos')
  const [station, setStation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    api<BranchContext>(`/b/${branchId}/context`)
      .then(setContext)
      .catch(() => setContext(null))
  }, [branchId])

  if (!managed.length) {
    return (
      <div className="page">
        <StaffHeader me={me} title={m.device.title} />
        <main className="staff-main">
          <Notice tone="error">{m.device.needManager}</Notice>
        </main>
      </div>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await api(`/b/${branchId}/devices`, { body: { name, kind, station: kind === 'kds' && station ? station : null } })
      await refresh()
      setDone(pickText(managed.find((b) => b.id === branchId)?.name, locale))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : m.errors.generic)
    }
  }

  return (
    <div className="page">
      <StaffHeader me={me} title={m.device.title} />
      <main className="staff-main narrow">
        <h1>{m.device.title}</h1>
        <p className="muted">{m.device.hint}</p>
        {done ? (
          <>
            <Notice tone="success">{fill(m.device.done, { branch: done })}</Notice>
            <Link className="btn btn-primary" to="/lock">
              {m.device.goToLock}
            </Link>
          </>
        ) : (
          <form className="card stack" onSubmit={submit}>
            {error && <Notice tone="error">{error}</Notice>}
            <SelectField label={m.device.branch} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {managed.map((b) => (
                <option key={b.id} value={b.id}>
                  {pickText(b.name, locale)} · {b.code}
                </option>
              ))}
            </SelectField>
            <Field label={m.device.name} placeholder={m.device.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
            <SelectField label={m.device.kind} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {m.device.kinds[k]}
                </option>
              ))}
            </SelectField>
            {kind === 'kds' && (
              <SelectField label={m.device.station} value={station} onChange={(e) => setStation(e.target.value)}>
                <option value="">{m.device.allStations}</option>
                {context?.branch.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pickText(s.name, locale)}
                  </option>
                ))}
              </SelectField>
            )}
            <Button type="submit">{m.device.submit}</Button>
          </form>
        )}
      </main>
    </div>
  )
}
