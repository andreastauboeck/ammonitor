interface SiteIconProps {
  /** Base tile size, default 'md' (36px square). */
  size?: 'sm' | 'md'
  /** When true, smoothly scale up to 1.5× the base size for emphasis. */
  expanded?: boolean
}

/**
 * Mini amber tile + ammonitor logo PNG.
 * Mirrors the home hero treatment so the brand looks consistent at small sizes.
 *
 * The wrapper uses `transform: scale(...)` for the expansion animation so layout
 * around it stays stable (no surrounding text reflow on hover).
 */
export default function SiteIcon({ size = 'md', expanded = false }: SiteIconProps) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const inner = size === 'sm' ? 'w-5 h-6' : 'w-7 h-8'
  // 1.5× scale on expand for a prominent but contained pop-out.
  const scale = expanded ? 'scale-[1.5]' : 'scale-100'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-amber-50 shrink-0 transition-transform duration-200 ease-out origin-center will-change-transform ${dim} ${scale}`}
    >
      <img src="/logo.png" alt="" className={`${inner} object-contain`} />
    </span>
  )
}
