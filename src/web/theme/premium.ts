/**
 * Aegis Premium. The badge, and Paddle's overlay checkout: the CSP refuses the
 * inline style attributes Paddle.js sets on its frame and loader, so these
 * rules (same values Paddle uses) place them instead.
 */
export const cssPremium = `
.premium-badge{display:inline-block;margin-left:.15em;padding:0 .4em;border:1px solid var(--accent,#0f766e);border-radius:4px;font-size:.85em;line-height:1.5;color:var(--accent,#0f766e);white-space:nowrap}
.premium-checkout{margin:.75rem 0}
.premium-checkout [data-premium-status]:empty{display:none}
iframe.paddle-frame-overlay{position:fixed;inset:0;z-index:2147483647;display:block;width:100%;height:100%;margin:0;padding:0;border:0 none transparent;background-color:transparent;overflow-x:hidden;overflow-y:auto;visibility:visible;-webkit-tap-highlight-color:transparent}
.paddle-loader{position:fixed;inset:0;z-index:99998;display:block;width:100%;height:100%;margin:0;padding:0;background:rgba(0,0,0,.38)}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr));gap:1.5rem;margin:2rem 0}
.pricing-card{border:1px solid var(--border);border-radius:12px;padding:2rem;background:var(--surface);display:flex;flex-direction:column;justify-content:space-between}
.pricing-card.recommended{border:2px solid var(--accent,#0f766e);position:relative}
.pricing-tag{position:absolute;top:-12px;right:20px;background:var(--accent,#0f766e);color:#fff;font-size:.75rem;font-weight:700;padding:.2rem .8rem;border-radius:999px;text-transform:uppercase;letter-spacing:.05em}
.pricing-price{font-size:2rem;margin:.75rem 0 .25rem;font-weight:700}
.pricing-period{font-size:1rem;color:var(--muted,#666);font-weight:normal}
.pricing-features{list-style:none;padding:0;margin:0 0 1.5rem;line-height:1.8}
.refund-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr));gap:1rem;margin:1rem 0}
.refund-card{border:1px solid var(--border);border-radius:8px;padding:1.2rem;background:var(--surface)}
.center{text-align:center}
`;
