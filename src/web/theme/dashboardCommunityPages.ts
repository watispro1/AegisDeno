/**
 * Community pages pass (giveaways, suggestions, Ghost Watch, polls, starboard
 * top posts, staff digest): card-list toolbar states, poll and suggestion card
 * heads, and the digest's schedule line. Uses the module-page kit's classes
 * (theme/dashboardModulePages.ts) for chips, pills and help panels.
 * Loaded right before responsive.ts.
 */
export const cssDashboardCommunityPages = `
/* Card lists driven by clientCommunityPages.ts */
li[data-cl-q-out], li[data-cl-chip-out], li[data-cl-paged-out] { display: none; }
html:not(.js) .card-tools { display: none; }
.card-tools { margin-top: .5rem; }

/* Card heads: pill first, then the faint meta line, wrapping on phones */
.item-card .item-head { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; }
.item-card .item-head .faint { min-width: 0; overflow-wrap: anywhere; }
.poll-card .poll-question { margin: .5rem 0 .4rem; font-size: 1rem; overflow-wrap: anywhere; }
.poll-card .poll-options li { overflow-wrap: anywhere; }
.poll-lead { display: inline-flex; margin-left: .35rem; }

/* Section headings with a count */
.community-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; margin: 1.5rem 0 .5rem; }

/* Starboard top: rank badges for the podium */
.rank-badge { display: inline-block; min-width: 1.6rem; padding: 0 .3rem; text-align: center; font: 600 .8rem/1.6 var(--mono); border: 1px solid var(--border-strong); border-radius: 999px; }
.rank-badge.rank-1 { color: var(--warn); border-color: currentColor; }

/* Digest: live schedule line under the form */
.schedule-line { margin: .25rem 0 .75rem; font-size: .9rem; color: var(--muted); }

@media (max-width: 640px) {
  .item-card .review-form .btn-row { display: flex; flex-wrap: wrap; gap: .35rem; }
  .item-card .review-form .btn-row .btn { flex: 1 1 6rem; }
  .card-tools .list-sort { flex: 1 1 100%; }
}
`;
