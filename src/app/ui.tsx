// Small building blocks for the staff screens: big touch targets, high contrast.
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...props} />
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" aria-hidden="true" />
      {label && <span className="visually-hidden">{label}</span>}
    </div>
  )
}

/** 4–6 digit PIN pad with keyboard support. */
export function PinPad({
  value,
  onChange,
  onSubmit,
  disabled,
  labels,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  labels: { clear: string; submit: string; prompt: string }
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (disabled) return
      if (/^\d$/.test(event.key) && value.length < 6) onChange(value + event.key)
      else if (event.key === 'Backspace') onChange(value.slice(0, -1))
      else if (event.key === 'Enter' && value.length >= 4) onSubmit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, onChange, onSubmit, disabled])

  return (
    <div className="pinpad">
      <p className="pinpad-prompt">{labels.prompt}</p>
      <div className="pinpad-dots" aria-label={`${value.length} / 6`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={i < value.length ? 'filled' : ''} />
        ))}
      </div>
      <div className="pinpad-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} type="button" disabled={disabled || value.length >= 6} onClick={() => onChange(value + digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="pinpad-clear" disabled={disabled} onClick={() => onChange('')}>
          {labels.clear}
        </button>
        <button type="button" disabled={disabled || value.length >= 6} onClick={() => onChange(value + '0')}>
          0
        </button>
        <button type="button" className="pinpad-ok" disabled={disabled || value.length < 4} onClick={onSubmit}>
          {labels.submit}
        </button>
      </div>
    </div>
  )
}
