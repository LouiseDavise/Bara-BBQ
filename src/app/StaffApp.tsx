// Staff and head-office app routes. middleware.ts already sends signed-out visitors of /staff
// and /hq to /login (or /lock on a registered device); RequireSession covers client navigation.
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DemoRibbon } from '../common/DemoRibbon'
import { I18nProvider, SessionProvider, useI18n, useSession } from './context'
import { BranchShell } from './pages/BranchShell'
import { DevicePage } from './pages/DevicePage'
import { HqShell } from './pages/HqShell'
import { homeFor, LoginPage } from './pages/LoginPage'
import { LockPage } from './pages/LockPage'
import type { MeResponse } from './types'
import { Notice, Spinner } from './ui'

function RequireSession({ children }: { children: (me: MeResponse) => ReactNode }) {
  const { session } = useSession()
  const location = useLocation()
  if (session.status === 'loading') return <Spinner />
  if (session.status === 'signedOut') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children(session.me)}</>
}

function OfflineBanner() {
  const { m } = useI18n()
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online ? null : <div className="offline-banner" role="alert">{m.shell.offline}</div>
}

function NotFound() {
  const { m } = useI18n()
  return (
    <main className="staff-main narrow">
      <Notice tone="error">{m.errors.notFound}</Notice>
    </main>
  )
}

function Routed() {
  const { m } = useI18n()
  return (
    <>
      <DemoRibbon m={m} />
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lock" element={<LockPage />} />
        <Route path="/device" element={<RequireSession>{(me) => <DevicePage me={me} />}</RequireSession>} />
        <Route path="/staff" element={<RequireSession>{(me) => <Navigate to={homeFor(me.user, null)} replace />}</RequireSession>} />
        <Route path="/staff/:branchId/*" element={<RequireSession>{(me) => <BranchShell me={me} />}</RequireSession>} />
        <Route path="/hq/*" element={<RequireSession>{(me) => <HqShell me={me} />}</RequireSession>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export function StaffApp() {
  return (
    <SessionProvider>
      <I18nProvider>
        <Routed />
      </I18nProvider>
    </SessionProvider>
  )
}
