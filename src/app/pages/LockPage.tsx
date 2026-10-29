// /lock: the PIN screen of a registered device. Pick your name, enter your PIN.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { useI18n, useSession } from '../context'
import type { DeviceMe } from '../types'
import { Button, Notice, PinPad, Spinner } from '../ui'

export function LockPage() {
  const { m } = useI18n()
  const { refresh } = useSession()
  const navigate = useNavigate()
  const [device, setDevice] = useState<DeviceMe | null>(null)
  const [unregistered, setUnregistered] = useState(false)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<DeviceMe>('/devices/me')
      .then(setDevice)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 403) setUnregistered(true)
        else setError(m.errors.generic)
      })
  }, [m])

  const submit = useCallback(async () => {
    if (!staffId || !device) return
    setBusy(true)
    setError(null)
    try {
      await api('/auth/pin', { body: { staffId, pin } })
      await refresh()
      navigate(`/staff/${device.branch.id}`, { replace: true })
    } catch (caught) {
      setPin('')
      setError(caught instanceof ApiError && caught.code === 'pin_locked' ? m.lock.locked : m.lock.wrongPin)
      setBusy(false)
    }
  }, [staffId, device, pin, refresh, navigate, m])

  if (unregistered) {
    return (
      <div className="page page-lock">
        <main className="staff-main narrow">
          <Notice>{m.lock.notRegistered}</Notice>
          <Link className="btn btn-primary" to="/device">
            {m.lock.register}
          </Link>
        </main>
      </div>
    )
  }
  if (!device) return error ? <Notice tone="error">{error}</Notice> : <Spinner />

  const person = device.staff.find((s) => s.id === staffId)
  return (
    <div className="page page-lock">
      <main className="staff-main">
        <header className="lock-header">
          <span className="wordmark small">Bara</span>
          <strong>
            {device.branch.name} · {device.device.name}
          </strong>
        </header>
        {!person ? (
          <>
            <h1>{m.lock.title}</h1>
            <ul className="lock-people">
              {device.staff.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setStaffId(s.id)}>
                    <span className="lock-name">{s.name}</span>
                    {s.role && <span className="muted">{m.roles[s.role]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="lock-pin">
            <h1>{person.name}</h1>
            {error && <Notice tone="error">{error}</Notice>}
            <PinPad value={pin} onChange={setPin} onSubmit={() => void submit()} disabled={busy} labels={{ clear: m.lock.clear, submit: 'OK', prompt: m.lock.enterPin }} />
            <Button
              variant="quiet"
              onClick={() => {
                setStaffId(null)
                setPin('')
                setError(null)
              }}
            >
              {m.lock.back}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
