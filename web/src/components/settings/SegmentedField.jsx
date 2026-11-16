// Segmented settings field.

const COLUMNS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

export default function SegmentedField({
  name,
  label,
  helper,
  value,
  options,
  onChange,
  error,
}) {
  return (
    <fieldset className="p-4 md:p-5">
      <legend className="float-left w-full text-sm font-medium text-text">
        {label}
      </legend>
      {helper && (
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-text-muted">
          {helper}
        </p>
      )}

      <div
        className={`mt-3 grid gap-1 rounded-control bg-bg p-1 ${
          COLUMNS[options.length] ?? 'grid-cols-2'
        }`}
      >
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label key={String(option.value)} className="relative flex">
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`press tabular w-full cursor-pointer rounded-card px-1 py-3 text-center text-xs font-medium transition-[filter,transform,background-color,color] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  checked
                    ? 'bg-surface-2 font-semibold text-accent'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {option.label}
              </span>
            </label>
          )
        })}
      </div>

      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </fieldset>
  )
}
