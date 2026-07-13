
export function CarScene({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const bodyFill = tone === "dark" ? "#ffffff" : "var(--brand)";
  const bodyStroke = tone === "dark" ? "rgba(255,255,255,0.85)" : "var(--brand)";
  const roadColor = tone === "dark" ? "rgba(255,255,255,0.55)" : "rgba(30,58,95,0.35)";
  const groundColor = tone === "dark" ? "rgba(255,255,255,0.1)" : "rgba(30,58,95,0.08)";

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Sky gradient dots (subtle) */}
      <div className="absolute inset-x-0 top-4 flex justify-between px-8 opacity-30">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-1 w-1 rounded-full bg-current animate-car-bob"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {/* Car (drives left→right and back) */}
      <div className="absolute inset-x-0 bottom-12 flex justify-center">
        <div className="animate-car-drive">
          <div className="animate-car-bob relative">
            {/* Smoke */}
            <div className="absolute -left-2 top-6 h-2 w-2 rounded-full bg-current opacity-40 animate-smoke" />
            <div
              className="absolute -left-4 top-8 h-2 w-2 rounded-full bg-current opacity-30 animate-smoke"
              style={{ animationDelay: "0.4s" }}
            />
            <svg width="180" height="70" viewBox="0 0 180 70" fill="none">
              {/* Body */}
              <path
                d="M10 50 Q20 30 55 28 L80 12 Q95 6 115 8 L145 12 Q168 16 172 34 L172 50 Z"
                fill={bodyFill}
                stroke={bodyStroke}
                strokeWidth="1.5"
              />
              {/* Windows */}
              <path
                d="M62 28 L82 14 Q95 9 112 11 L128 27 Z"
                fill="rgba(255,255,255,0.25)"
                stroke="rgba(255,255,255,0.5)"
              />
              <line x1="97" y1="10" x2="97" y2="28" stroke="rgba(255,255,255,0.5)" />
              {/* Headlight */}
              <circle cx="167" cy="34" r="3" fill="#fde68a" />
              {/* Wheels */}
              <g transform="translate(45,52)">
                <circle r="10" fill="#111827" />
                <g className="animate-wheel-spin origin-center">
                  <circle r="4" fill="#6b7280" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#e5e7eb" strokeWidth="1.2" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="#e5e7eb" strokeWidth="1.2" />
                </g>
              </g>
              <g transform="translate(140,52)">
                <circle r="10" fill="#111827" />
                <g className="animate-wheel-spin origin-center">
                  <circle r="4" fill="#6b7280" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#e5e7eb" strokeWidth="1.2" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="#e5e7eb" strokeWidth="1.2" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Road */}
      <div
        className="absolute inset-x-0 bottom-6 h-[2px]"
        style={{ backgroundColor: roadColor }}
      />
      <div
        className="road-stripes absolute inset-x-0 bottom-3 h-[3px]"
        style={{ color: roadColor }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-3"
        style={{ backgroundColor: groundColor }}
      />
    </div>
  );
}
