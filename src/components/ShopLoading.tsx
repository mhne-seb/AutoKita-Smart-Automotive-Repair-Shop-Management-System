import { Loader2 } from 'lucide-react'

// Loading scene used across the app: a line-art car in the brand palette driving
// past a faint city skyline. Wheels spin and the body bobs. Shown in place of the page's cards until the data arrives.
export function ShopLoading({ message = 'Loading your shop floor' }: { message?: string }) {
  const navy = '#1e3a5f'
  const blue = '#3b82f6'
  const blueLight = '#bfdbfe'
  const grey = '#cbd5e1'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <svg width="360" height="200" viewBox="0 0 360 200" fill="none" aria-hidden="true">
        {/* City skyline — faint grey outlines, no fill */}
        <g stroke={grey} strokeWidth="2" strokeLinejoin="round">
          <path d="M30 150 V110 H56 V96 H74 V150" />
          <path d="M92 150 V70 H118 V80 H130 V150" />
          <path d="M148 150 V100 H166 V88 H180 V100 H192 V150" />
          <path d="M214 150 V62 H244 V150" />
          <path d="M262 150 V92 H286 V78 H298 V92 H310 V150" />
          <path d="M320 150 V118 H338 V150" />
          {/* a few windows */}
          <path d="M100 82 h6 M100 94 h6 M110 82 h6 M110 94 h6 M222 74 h6 M232 74 h6 M222 86 h6 M232 86 h6" strokeLinecap="round" />
        </g>
        {/* Bushes / clouds at the edges */}
        <path d="M6 128 c4 -10 12 -4 16 -10 c4 -6 10 -2 12 4 c6 -2 12 2 10 8" stroke={grey} strokeWidth="2" strokeLinecap="round" />
        <path d="M312 130 c4 -10 12 -4 16 -10 c4 -6 10 -2 12 4 c6 -2 12 2 10 8" stroke={grey} strokeWidth="2" strokeLinecap="round" />

        {/* Car — nudged left so the whole vehicle sits centred */}
        <g transform="translate(-10 0)">
        <g className="animate-car-bob">
          <path
            d="M96 156 L100 134 Q102 126 112 126 L150 126 L156 104 Q160 98 170 98 L216 98 Q226 98 232 106 L250 126 L272 128 Q286 132 284 156 Z"
            fill="#ffffff" stroke={navy} strokeWidth="3" strokeLinejoin="round"
          />
          <path d="M162 104 L156 124 L192 124 L192 104 Z" fill={blueLight} stroke={navy} strokeWidth="2" strokeLinejoin="round" />
          <path d="M200 104 L218 104 L238 124 L200 124 Z" fill={blueLight} stroke={navy} strokeWidth="2" strokeLinejoin="round" />
          <line x1="206" y1="136" x2="220" y2="136" stroke={navy} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="100" y="138" width="8" height="5" rx="1" fill={blue} />
          <rect x="274" y="138" width="8" height="5" rx="1" fill="#fbbf24" />
        </g>
        </g>
        {/* Wheels */}
        {[118, 240].map((cx) => (
          <g key={cx} className="animate-wheel-spin" style={{ transformOrigin: `${cx}px 156px` }}>
            <circle cx={cx} cy="156" r="15" fill={blue} stroke={navy} strokeWidth="3" />
            <circle cx={cx} cy="156" r="5" fill="#ffffff" stroke={navy} strokeWidth="2" />
            <line x1={cx} y1="143" x2={cx} y2="169" stroke={navy} strokeWidth="2" />
            <line x1={cx - 13} y1="156" x2={cx + 13} y2="156" stroke={navy} strokeWidth="2" />
          </g>
        ))}

        {/* Ground — broken segments like the reference */}
        <g stroke={navy} strokeWidth="3" strokeLinecap="round">
          <path d="M10 178 h14 M34 178 h100 M148 178 h16 M178 178 h110 M302 178 h18 M334 178 h6" />
        </g>
      </svg>

      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Loader2 size={16} className="animate-spin text-brand" /> {message}
      </div>
    </div>
  )
}
