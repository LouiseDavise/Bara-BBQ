// /hq: the head-office shell. Group roles only; branch staff see a polite refusal (the API
// answers 403 too).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pickText } from '../../../shared/localized'
import { LOCALE_INFO } from '../../../shared/locales'
import { fill } from '../../i18n/types'
import { api, ApiError } from '../../lib/api'
import { useI18n, useNow } from '../context'
import type { HqContext, MeResponse } from '../types'
import { Notice, Spinner } from '../ui'
import { StaffHeader } from './StaffHeader'

export function HqShell({ me }: { me: MeResponse }) {
  const { m, locale } = useI18n()
  const now = useNow()
  const [context, setContext] = useState<HqContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<HqContext>('/hq/context')
      .then(setContext)
      .catch((caught: unknown) => setError(caught instanceof ApiError && caught.status === 403 ? m.hq.noAccess : m.errors.generic))
  }, [m])

  return (
    <div className="page">
      <StaffHeader me={me} title={m.hq.title} />
      <main className="staff-main">
        {error && <Notice tone="error">{error}</Notice>}
        {!error && !context && <Spinner />}
        {context && (
          <>
            <h1>{fill(m.home.greeting, { name: me.user.name })}</h1>
            <p className="lead">{context.groupRole ? m.roles[context.groupRole] : ''}</p>
            <p className="muted">{m.hq.phaseNote}</p>
            <h2>{m.hq.branches}</h2>
            <ul className="hq-branches">
              {context.branches.map((b) => (
                <li key={b.id} className="card">
                  <strong>
                    {pickText(b.name, locale)} <span className="code">{b.code}</span>
                  </strong>
                  <span className="muted">
                    {m.hq.localTime}{' '}
                    {new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { timeZone: b.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)} ·{' '}
                    {b.currency}
                  </span>
                  {me.user.branches.some((own) => own.id === b.id) && <Link to={`/staff/${b.id}`}>{m.shell.switchBranch} →</Link>}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
