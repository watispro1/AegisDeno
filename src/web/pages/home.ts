import { catalogStats } from "../catalog";
import { features, faqs, quickstart } from "../content";
import { type SiteConfig, type Stats, breadcrumb, cmdBlock, endNote, escapeHtml, faqBlock, jsonLd, page, safeUrl, slashInput, statusWord } from "./shared";

/* ── Home ──────────────────────────────────────────────────────────── */

export function renderHome(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);
  const cs = catalogStats();

  const refRows = features.map(f => {
    return `<div class="ref-row">
      <h3><a href="/features#${f.id}">${escapeHtml(f.title)}</a></h3>
      <p>${escapeHtml(f.short)}</p>
      <div class="ref-cmd"><code>${escapeHtml(f.start)}</code></div>
    </div>`;
  }).join("\n    ");

  const steps = quickstart.map(s => `<li>
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${s.body}</p>
          ${s.cmd ? cmdBlock(s.cmd) : ""}
        </div>
      </li>`).join("\n      ");

  const body = `
<div class="wrap">
  <section class="hero" aria-labelledby="hero-title">
    <div>
      <div class="hero-meta">
        <span><span class="dot${st.cls === "ok" ? "" : " danger"}" data-status-dot aria-hidden="true"></span><span data-status-state>${escapeHtml(st.label)}</span></span>
        <span>gateway <span data-live="ping" data-suffix=" ms">${stats.ping} ms</span></span>
        <span>v${escapeHtml(cfg.version)}</span>
      </div>
      <h1 id="hero-title">A moderation bot for Discord, run from slash commands.</h1>
      <p class="lead">Aegis handles warnings, timeouts, bans and the case log behind them, plus automod, ban appeals, tickets, verification and logging. You type a command in your server and it does the thing. Server managers can also review cases and change settings in the <a href="/dashboard">web dashboard</a>.</p>
      <div class="btn-row">
        <a class="btn" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
        <a class="text-link" href="/commands">See all ${cs.commands} commands &rarr;</a>
      </div>
    </div>

    <div class="hero-aside">
      <div class="dc" role="img" aria-label="Example: a moderator runs /warn and Aegis replies with the warning details">
        <div class="dc-bar"><span aria-hidden="true">#</span><b>mod-chat</b></div>
        <div class="dc-body">
          <div class="dc-msg">
            <div class="dc-avatar bot" aria-hidden="true">A</div>
            <div>
              <div class="dc-used">@sam used <code>/warn</code></div>
              <div class="dc-name">Aegis<span class="dc-tag">BOT</span><small>Today at 21:14</small></div>
              <div class="dc-embed yellow">
                <div class="dc-embed-title">Warning issued: medium severity</div>
                <div class="dc-fields">
                  <div class="dc-field"><b>User</b>@quickcash99</div>
                  <div class="dc-field"><b>Moderator</b>sam</div>
                  <div class="dc-field"><b>Total warnings</b>2 on record</div>
                </div>
                <div class="dc-field dc-reason"><b>Reason</b>Posting invite links in #general</div>
              </div>
            </div>
          </div>
        </div>
        ${slashInput("trustscore", [["user", "@quickcash99"]])}
      </div>
      <p class="hero-caption">Simplified example. The names are made up; the fields match the real reply.</p>
    </div>
  </section>
</div>

<section class="section" aria-labelledby="what-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="what-title">What it does</h2>
      <p>Each line links to the details. The command on the right is where you would start.</p>
    </div>
    <div class="ref">
    ${refRows}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="setup-title">
  <div class="wrap two-col">
    <div>
      <div class="section-head">
        <h2 id="setup-title">Setting it up</h2>
        <p>About five minutes. The <a href="/docs">docs</a> cover the rest.</p>
      </div>
      <ol class="steps">
      ${steps}
      </ol>
    </div>
    <div>
      <div class="section-head">
        <h2>Good to know</h2>
      </div>
      <ul class="notes">
        <li><strong>No Administrator.</strong> The invite asks only for the permissions its commands use. You can read the <a href="/docs#permissions">full list</a> before inviting.</li>
        <li><strong>Role order matters.</strong> Discord will not let a bot act on someone whose top role is above its own. Drag the Aegis role above the roles it should moderate.</li>
        <li><strong>Records expire.</strong> Warnings, cases and staff notes are deleted after a year.</li>
        <li><strong>Per-server data.</strong> Nothing is shared between servers. See the <a href="/privacy">privacy policy</a>.</li>
        <li><strong>Free.</strong> No paid tier, no locked features.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="faq-title">Questions</h2>
    </div>
    ${faqBlock(faqs)}
    ${endNote(cfg, `By adding Aegis you accept the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.`)}
  </div>
</section>`;

  return page(cfg, {
    title: "Aegis: a Discord moderation bot",
    description:
      "Aegis is a Discord moderation bot: warnings, timeouts, bans and case logs, plus automod, ban appeals, tickets, verification and logging. Configured with slash commands.",
    path: "/",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "Aegis",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Discord",
          description:
            "A Discord moderation bot: cases, automod, ban appeals, tickets, verification and logging, configured with slash commands.",
          softwareVersion: cfg.version,
          url: process.env.SITE_URL || "/",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: features.map(f => f.title),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${process.env.SITE_URL || ""}/` },
          ],
        },
      ],
    }),
  });
}

/* The /features page lives in features.ts. */
export { renderFeatures } from "./features";
