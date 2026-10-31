# Contributing to Aegis

Thanks for your interest in improving Aegis. Please read this before opening a
pull request.

## Before you start

- **Licence.** Aegis is source-available, not open source: the code is
  proprietary and all rights are reserved (see the [README](./README.md#licence)).
  Pull requests are welcome, but the maintainer decides what is merged. For
  anything larger than a small fix, open an issue first so we can agree on the
  approach before you spend time on it.
- **Conduct.** Everyone taking part is expected to follow the
  [Code of Conduct](./CODE_OF_CONDUCT.md).
- **Security problems** go through [`SECURITY.md`](./SECURITY.md), never a
  public issue or pull request.

## Setting up

You need Node.js 20 or newer (CI uses 22) and, to run the bot itself, a MongoDB
database and a Discord application. The tests do not need either.

```bash
git clone https://github.com/watispro1/AegisDeno.git
cd AegisDeno
npm ci
cp .env.example .env   # only needed to run the bot; see the README for each variable
npm run dev
```

## Branches and pull requests

1. Branch from an up-to-date `main`, with a short descriptive name such as
   `fix/ticket-autoclose` or `feat/site-search`.
2. Keep each pull request to one change. Open it as a draft while you are still
   working.
3. Fill in the pull request template: what changed, why, and how you tested it.
4. CI must pass. The maintainer reviews and merges. Every push to `main`
   deploys to production on Fly.io, so nothing is pushed to `main` directly.

## Sign-off (DCO)

Every commit needs a `Signed-off-by:` line. By adding it you certify the
[Developer Certificate of Origin](https://developercertificate.org/): that you
wrote the change, or otherwise have the right to submit it.

```bash
git commit -s -m "fix: keep ticket auto-close after a restart"
```

`-s` adds the line using your `user.name` and `user.email`. To add it to commits
you already made on your branch:

```bash
git rebase --signoff main
git push --force-with-lease
```

## Tests and checks

Run these before you push. CI runs the first two on every push and pull request.

```bash
npm run typecheck              # tsc --noEmit
npm test                       # unit tests, build, then the web smoke test
```

`npm test` runs `npm run test:unit` (every `tests/*.test.ts` file), then
`npm run build`, then `scripts/smoke-web.ts`, which starts the website with a
stub Discord client and checks every route, the security headers, cache
headers, the changelog pages and more.

Also useful:

```bash
npx tsx scripts/audit-site.ts  # broken links and anchors, unstyled classes, dead CSS
npm run preview:site           # static copy of the site in dist/site
```

Add or update tests with your change. Pure logic belongs in a module without
Discord or Mongo imports so it can be unit tested directly; see
`src/services/ticketTranscript.ts` or `src/web/notFound.ts` for the pattern.

## Changelogs and versions

Every user-facing change gets a changelog entry in the same pull request.

- Bot, website and repository changes go in [`CHANGELOG.md`](./CHANGELOG.md).
- Dashboard changes (anything under `/dashboard`) go in
  [`DASHBOARD_CHANGELOG.md`](./DASHBOARD_CHANGELOG.md). The dashboard has its
  own version numbers.
- Both follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): a
  `## [x.y.z] - YYYY-MM-DD` heading, then `### Added`, `### Changed`,
  `### Fixed`, `### Removed`, `### Deprecated` or `### Security` sections
  (the dashboard log also allows `### Known limitations`).
- **Always add a dated, numbered release, never an "upcoming" or placeholder
  section.** The website renders these files directly, and the smoke test fails
  if a page shows an undated release.
- When you add a release, bump the version to match: `VERSION` in
  `src/version.ts` and `version` in `package.json` and `package-lock.json`
  (`npm version x.y.z --no-git-tag-version`) for the bot, or
  `DASHBOARD_VERSION` in `src/version.ts` for the dashboard. The tests check
  that the newest changelog entry matches.
- Write entries for the people who use Aegis: say what changed for them, in
  plain words, and name commands and settings exactly.

## Style

- TypeScript, strict mode, CommonJS output. Run the typecheck.
- Match the code around you: two-space indentation, double quotes, semicolons.
- The website is plain server-rendered HTML from template strings in
  `src/web/`. Keep it that way:
  - No inline scripts or styles; the content security policy blocks them.
    Scripts go in `src/web/client/` (or `dashboard/client.ts`), styles in
    `src/web/theme/`.
  - Escape everything that comes from users or config (`escapeHtml`,
    `safeUrl`).
  - No third-party requests: no CDNs, fonts or analytics.
  - Phones: no horizontal scrolling at 360, 375 or 414px wide, form text at
    least 16px on small and touch screens, and tap targets at least 44px.
  - Accessibility: headings in order, labels on every input, visible focus,
    and text that reads at 4.5:1 contrast.
- Website copy must describe what the code actually does. If you change a
  feature, update `content.ts`, the docs page and, if it changes what is stored
  or for how long, the privacy policy in `pages/legal.ts`.
- Never commit secrets. `.env` is ignored by git; keep it that way.
