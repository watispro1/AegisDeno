/**
 * Aegis Premium CSS. The badge and pricing cards (no web checkout: Premium is sold in Discord).
 */
export const cssPremium = `
.premium-badge{display:inline-block;margin-left:.15em;padding:0 .4em;border:1px solid var(--accent,#0f766e);border-radius:4px;font-size:.85em;line-height:1.5;color:var(--accent,#0f766e);white-space:nowrap}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr));gap:1.5rem;margin:2rem 0}
.pricing-card{border:1px solid var(--border);border-radius:var(--r-lg);padding:2rem;background:var(--surface);display:flex;flex-direction:column;justify-content:space-between;transition:transform .2s ease,box-shadow .2s ease}
.pricing-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px -4px rgba(0,0,0,.12)}
.pricing-card.recommended{border:2px solid var(--accent,#0f766e);position:relative}
.pricing-tag{position:absolute;top:-12px;right:20px;background:var(--accent,#0f766e);color:var(--accent-ink,#fff);font-size:.75rem;font-weight:700;padding:.2rem .8rem;border-radius:999px;text-transform:uppercase;letter-spacing:.05em}
.pricing-tag.dev{background:var(--warn,#d97706);color:#1b1b19}
.pricing-price{font-size:2rem;margin:.75rem 0 .25rem;font-weight:700}
.pricing-period{font-size:1rem;color:var(--muted,#666);font-weight:normal}
.pricing-features{list-style:none;padding:0;margin:0 0 1.5rem;line-height:1.8}
.center{text-align:center}
`;
