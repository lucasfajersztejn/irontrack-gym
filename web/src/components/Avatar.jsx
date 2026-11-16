// User avatar with initials fallback.
export default function Avatar({ user, className = 'h-9 w-9 text-sm' }) {
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }
  const initial = (user?.username ?? user?.name ?? '?').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-text`}
    >
      {initial}
    </span>
  )
}
