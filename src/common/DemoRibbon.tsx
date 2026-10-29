// Slim, dismissible "This is a STOEDIO demo restaurant · stoedio.com" ribbon (DEMO_MODE only).
import { useState } from 'react'
import { readLocal, writeLocal } from '../lib/storage'

const KEY = 'bara.demoRibbonDismissed'

export function DemoRibbon({ m }: { m: { demo: { ribbon: string; dismiss: string } } }) {
  const [dismissed, setDismissed] = useState(() => readLocal(KEY) === '1')
  if (!__DEMO_MODE__ || dismissed) return null
  return (
    <div className="demo-ribbon" role="note">
      <span>
        {m.demo.ribbon} · <a href="https://stoedio.com">stoedio.com</a>
      </span>
      <button
        type="button"
        className="demo-ribbon-close"
        aria-label={m.demo.dismiss}
        onClick={() => {
          writeLocal(KEY, '1')
          setDismissed(true)
        }}
      >
        ×
      </button>
    </div>
  )
}
