/** Trust, members, activity, analytics, automod and embed builder pages (views/trust.ts and friends). */
export const cssDashboardTrustPages = `
.trust-status{display:flex;flex-wrap:wrap;gap:.4rem;margin:.25rem 0 .75rem}
.member-count{margin:.5rem 0}
.automod-summary{border:1px solid var(--border);border-radius:4px;padding:.75rem 1rem;margin:0 0 1rem}
.automod-summary .section-title{margin-top:0}
.automod-rule-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.35rem .75rem}
.automod-rule-list li{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem}
fieldset.automod-rule{scroll-margin-top:4.5rem}
.rule-help{margin:0 0 .5rem}
.embed-preview-label strong{margin-right:.35rem}
.embed-total[data-over]{color:var(--danger);font-weight:600}
.embed-over{margin-top:.5rem}
@media (max-width:640px){
  .automod-rule-list{grid-template-columns:1fr}
  .automod-summary{padding:.6rem .75rem}
  .trust-member-table td[data-label="Band"] .pill{white-space:nowrap}
}
`;
