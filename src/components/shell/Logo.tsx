export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pos-soft text-pos">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 12c0-1.5.8-2.3 2.4-2.3h.4V6.8c0-2 .9-3.4 3-3.4h.3c1.9 0 2.9 1.2 2.9 3v2.8h2.3c1.7 0 2.5.8 2.5 2.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="4.5" y="12" width="15" height="7.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        CashTrac
      </span>
    </div>
  )
}
