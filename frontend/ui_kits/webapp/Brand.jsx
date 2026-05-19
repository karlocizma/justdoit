/* global React */

// Reusable brand lockup. Renders the gradient mark + lowercase wordmark.
// Inline so the parent's Space Grotesk applies and sizes are honored.
function Brand({ size = 28, color = "var(--jd-fg)", showWordmark = true }) {
  const wmSize = Math.round(size * 0.7);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: size * 0.25,
          background: "linear-gradient(135deg, #6c63ff, #48d1cc)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32" fill="none">
          <path
            d="M22 8v13c0 4-2.5 6.5-6.5 6.5-3 0-5.2-1.2-6.3-2.9"
            stroke="#0f1117"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--jd-font-display)',
            fontWeight: 700,
            fontSize: wmSize,
            letterSpacing: `${-wmSize * 0.05}px`,
            lineHeight: 1,
            color,
          }}
        >
          justdoit
        </span>
      )}
    </div>
  );
}

window.Brand = Brand;
