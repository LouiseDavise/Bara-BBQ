// On a shared device, return to the PIN screen after the branch's idle time.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context'

export function useIdleLock(minutes: number | null): void {
  const { signOut } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!minutes) return
    let timer: ReturnType<typeof setTimeout>
    const lock = () => {
      void signOut().then(() => navigate('/lock', { replace: true }))
    }
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(lock, minutes * 60_000)
    }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, reset))
    }
  }, [minutes, signOut, navigate])
}
