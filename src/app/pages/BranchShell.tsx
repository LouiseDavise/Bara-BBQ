// /staff/:branchId: the branch shell. Phase 1 shows the user's role and what it may do in this
// branch (straight from the permission matrix); later phases put the real screens in the tiles.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { pickText } from '../../../shared/localized'
import type { BranchPermission, Grant } from '../../../shared/permissions'
import { fill, type StaffMessages } from '../../i18n/types'
import { api, ApiError } from '../../lib/api'
import { useI18n, useSession } from '../context'
import type { BranchContext, MeResponse } from '../types'
import { Notice, Spinner } from '../ui'
import { useIdleLock } from './useIdleLock'
import { StaffHeader } from './StaffHeader'

const MODULES: { key: keyof StaffMessages['modules']; permissions: BranchPermission[] }[] = [
  { key: 'floor', permissions: ['floor.view', 'table.open', 'order.take'] },
  { key: 'host', permissions: ['reservation.manage', 'waitlist.manage'] },
  { key: 'pos', permissions: ['payment.take', 'bill.view', 'line.void', 'refund.issue'] },
  { key: 'kds', permissions: ['kds.use', 'item.soldOut'] },
  { key: 'takeaway', permissions: ['takeaway.manage'] },
  { key: 'menu', permissions: ['menu.branch.availability', 'menu.branch.price'] },
  { key: 'inventory', permissions: ['stock.count', 'purchasing.manage', 'inventory.view'] },
  { key: 'reports', permissions: ['reports.branch', 'expenses.create'] },
  { key: 'settings', permissions: ['settings.branch', 'devices.manage'] },
  { key: 'staff', permissions: ['staff.branch'] },
  { key: 'customers', permissions: ['customers.view'] },
]

const RANK: Record<Grant | 'deny', number> = { deny: 0, read: 1, approval: 2, allow: 3 }

function bestOf(grants: BranchContext['grants'], permissions: BranchPermission[]): Grant | 'deny' {
  return permissions.reduce<Grant | 'deny'>((best, p) => (RANK[grants[p]] > RANK[best] ? grants[p] : best), 'deny')
}

export function BranchShell({ me }: { me: MeResponse }) {
  const { branchId = '' } = useParams()
  const { m, locale } = useI18n()
  const { refresh } = useSession()
  const [context, setContext] = useState<BranchContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContext(null)
    setError(null)
    api<BranchContext>(`/b/${encodeURIComponent(branchId)}/context`)
      .then(setContext)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) void refresh()
        setError(caught instanceof ApiError && caught.status === 403 ? m.errors.branchForbidden : caught instanceof ApiError && caught.status === 404 ? m.errors.notFound : m.errors.generic)
      })
  }, [branchId, m, refresh])

  useIdleLock(me.pinSession ? (context?.branch.idleLockMin ?? null) : null)

  if (error) {
    return (
      <div className="page">
        <StaffHeader me={me} title={branchId.toUpperCase()} />
        <main className="staff-main">
          <Notice tone="error">{error}</Notice>
          {me.user.branches.length > 0 && (
            <>
              <h2>{m.shell.yourBranches}</h2>
              <ul className="branch-links">
                {me.user.branches.map((b) => (
                  <li key={b.id}>
                    <Link to={`/staff/${b.id}`}>
                      {pickText(b.name, locale)} · {b.code}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
    )
  }
  if (!context) return <Spinner />

  const { branch, role, grants } = context
  return (
    <div className="page">
      <StaffHeader me={me} title={`${pickText(branch.name, locale)} · ${branch.code}`} branchId={branch.id} timeZone={branch.timeZone} />
      <main className="staff-main">
        <h1>{fill(m.home.greeting, { name: me.user.name })}</h1>
        <p className="lead">
          {fill(m.home.roleHere, { role: role ? m.roles[role] : '—' })} · {fill(m.shell.businessDay, { date: context.businessDate })}
        </p>
        <p className="muted">{m.home.phaseNote}</p>
        <ul className="module-grid">
          {MODULES.map(({ key, permissions }) => {
            const grant = bestOf(grants, permissions)
            const label = { allow: m.home.allowed, approval: m.home.approval, read: m.home.readOnly, deny: m.home.notAllowed }[grant]
            return (
              <li key={key} className={`module module-${grant}`}>
                <span className="module-name">{m.modules[key]}</span>
                <span className="module-grant">{label}</span>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
