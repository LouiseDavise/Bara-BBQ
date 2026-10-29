// "Website & system by STOEDIO", translated, on every public page.
export function StoedioCredit({ m }: { m: { footer: { credit: string } } }) {
  return (
    <a className="stoedio-credit" href="https://stoedio.com">
      {m.footer.credit}
    </a>
  )
}
