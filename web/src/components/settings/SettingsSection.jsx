// Settings section wrapper.
export default function SettingsSection({ title, status, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {title}
        </h2>
        <p
          aria-live="polite"
          className={`text-[11px] font-medium ${
            status?.tone === 'saved' ? 'text-accent' : 'text-text-muted'
          }`}
        >
          {status?.label ?? ''}
        </p>
      </div>
      <div className="card-liquid flex flex-col divide-y divide-border rounded-container">
        {children}
      </div>
    </section>
  )
}
