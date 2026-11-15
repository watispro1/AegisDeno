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
`;
