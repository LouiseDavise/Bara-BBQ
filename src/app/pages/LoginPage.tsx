// /login: username + password, and in DEMO_MODE one-tap buttons for every role in every branch.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pickText } from '../../../shared/localized'
import { BRANCH_ROLES, type Role } from '../../../shared/permissions'
import { fill } from '../../i18n/types'
import { api, ApiError } from '../../lib/api'
import { useI18n, useSession } from '../context'
import type { DemoAccounts, MeResponse } from '../types'
import { Button, Field, Notice } from '../ui'

/** Where a user lands after signing in. */
export function homeFor(me: MeResponse['user'], next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (me.groupRole && me.groupRole !== 'area') return '/hq'
  return me.branches[0] ? `/staff/${me.branches[0].id}` : '/hq'
}

function DemoLogin({ onSignedIn }: { onSignedIn: (me: MeResponse['user']) => void }) {
  const { m, locale } = useI18n()
  const [demo, setDemo] = useState<DemoAccounts | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<DemoAccounts>('/auth/demo')
      .then(setDemo)
      .catch(() => setDemo(null))
  }, [])

  if (!demo) return null

  const enter = async (staffId: string) => {
    setBusy(staffId)
    setError(null)
    try {
      const { user } = await api<{ user: MeResponse['user'] }>('/auth/demo', { body: { staffId } })
      onSignedIn(user)
    } catch {
      setError(m.errors.generic)
      setBusy(null)
    }
  }

  const button = (staffId: string, role: Role | null, label?: string) => (
    <Button key={staffId} variant="secondary" disabled={busy !== null} onClick={() => void enter(staffId)}>
      {label ?? (role ? m.roles[role] : staffId)}
    </Button>
  )
  const group = demo.accounts.filter((a) => a.groupRole && !a.branchId)

  return (
    <section className="demo-login" aria-labelledby="demo-title">
      <h2 id="demo-title">{m.login.demoTitle}</h2>
      <p className="muted">{fill(m.login.demoHint, { pin: demo.managerPin })}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="demo-grid">
        <div className="demo-branch">
          <h3>{m.login.groupTitle}</h3>
          <div className="demo-buttons">
            {group.map((a) => button(a.staffId, a.groupRole, a.groupRole === 'area' ? `${m.roles.area} · ${a.name}` : undefined))}
          </div>
        </div>
        {demo.branches.map((branch) => (
          <div className="demo-branch" key={branch.id}>
            <h3>
              {pickText(branch.city, locale)} <span className="code">{branch.code}</span>
            </h3>
            <div className="demo-buttons">
              {BRANCH_ROLES.map((role) => {
                const account = demo.accounts.find((a) => a.branchId === branch.id && a.role === role && !a.groupRole)
                return account ? button(account.staffId, role) : null
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LoginPage() {
  const { m } = useI18n()
  const { refresh } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signedIn = async (user: MeResponse['user']) => {
    await refresh()
    navigate(homeFor(user, params.get('next')), { replace: true })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api<{ user: MeResponse['user'] }>('/auth/login', { body: { username, password } })
      await signedIn(user)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429 ? m.login.rateLimited : m.login.invalid)
      setBusy(false)
    }
  }

  return (
    <div className="page page-login">
      <header className="login-brand">
        <span className="wordmark">
          Bara <span lang="zh-Hant">炭焰</span>
        </span>
        <span className="muted">{m.app.name}</span>
      </header>
      <form className="card login-form" onSubmit={submit}>
        <h1>{m.login.title}</h1>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={m.login.username} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" />
        <Field label={m.login.password} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" disabled={busy}>
          {busy ? m.login.submitting : m.login.submit}
        </Button>
      </form>
      <DemoLogin onSignedIn={(user) => void signedIn(user)} />
      <p className="login-footer">
        <a href="/">{m.login.publicSite}</a>
      </p>
    </div>
  )
}
