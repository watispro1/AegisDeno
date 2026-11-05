/** Styles for the community pages: poll results, the suggestion search bar and the giveaway Cancel confirmation. */
export const cssDashboardCommunity = `
.search-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 1rem; }
.search-bar select { min-height: 40px; padding: .35rem .5rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.poll-question { margin: .2rem 0 .6rem; font-size: 1rem; overflow-wrap: anywhere; }
.poll-options { list-style: none; padding: 0; margin: 0 0 .5rem; display: grid; gap: .35rem; }
.poll-options li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(6rem, 12rem) auto; gap: .75rem; align-items: center; margin: 0; }
.poll-label { overflow-wrap: anywhere; }
.poll-options meter { width: 100%; height: .7rem; }
.poll-count { white-space: nowrap; font-size: .9rem; }
.cancel-gw { display: inline-block; vertical-align: middle; margin-left: .35rem; }
.cancel-gw > summary { list-style: none; cursor: pointer; }
.cancel-gw > summary::-webkit-details-marker { display: none; }
.confirm-form { display: grid; gap: .5rem; margin-top: .5rem; padding: .6rem .75rem; max-width: 22rem; border: 1px solid var(--danger); border-radius: var(--r); background: var(--surface); font-size: .88rem; }
.confirm-form label { display: flex; gap: .45rem; align-items: flex-start; }
@media (max-width: 640px) {
  .poll-options li { grid-template-columns: minmax(0, 1fr) auto; }
  .poll-options meter { grid-column: 1 / -1; grid-row: 2; }
}
`;
