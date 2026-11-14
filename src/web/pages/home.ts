import { catalogStats } from "../catalog";
import { getReleases } from "../changelog";
import { features, faqs, quickstart } from "../content";
import { HEADLINE } from "./featuresData";
import { icon, iconSprite, type IconId } from "./icons";
import { botShowcase } from "./botReplies";
import { audienceSplit, differentiators, whatsNewStrip } from "./homeSections";
import { type SiteConfig, type Stats, cmdBlock, endNote, escapeHtml, faqBlock, fmtNum, fmtUptime, jsonLd, page, safeUrl, slashInput, statStrip, statusWord } from "./shared";

/* Home */

/** Where each home feature row points on /features, and its icon. Kept honest by a test. */
export const HOME_FEATURE_LINKS: Record<string, { anchor: string; icon: IconId }> = {
  moderation: { anchor: "actions", icon: "gavel" },
  automod: { anchor: "filters", icon: "filter" },
  trustscore: { anchor: "trust-score", icon: "gauge" },
  appeal: { anchor: "appeals", icon: "mail" },
  watchlist: { anchor: "notes", icon: "eye" },
  modreport: { anchor: "reports", icon: "chart" },
  logging: { anchor: "logging", icon: "pulse" },
  tickets: { anchor: "tickets-card", icon: "ticket" },
  verification: { anchor: "verification", icon: "shield" },
  community: { anchor: "engage", icon: "star" },
  automation: { anchor: "automation", icon: "clock" },
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function renderHome(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);
  const cs = catalogStats();
  const latest = getReleases()[0];

  const highlights = HEADLINE.map(h => `<li class="home-highlight">
        <a href="/features${escapeHtml(h.href)}">
          ${icon(h.icon, "f-icon lg")}
          <strong>${escapeHtml(h.title)}</strong>
          <span><b>${escapeHtml(h.outcome)}</b> ${escapeHtml(h.text)}</span>
        </a>
      </li>`).join("\n      ");

  const featureCards = features.map(f => {
    const link = HOME_FEATURE_LINKS[f.id] ?? { anchor: "", icon: "shield" as IconId };
    const href = link.anchor ? `/features#${link.anchor}` : "/features";
    const docs = `/docs#${f.docs ?? f.id}`;
    return `<li class="home-feature">
        <div class="home-feature-head">${icon(link.icon)}<h3><a href="${docs}">${escapeHtml(f.title)}</a></h3></div>
        <p><strong>${escapeHtml(f.outcome)}</strong> ${escapeHtml(f.short)}</p>
        <div class="home-feature-start">
          <span class="faint">Start with</span>
          <code>${escapeHtml(f.start)}</code>
          <button class="copy-btn sm-copy" type="button" data-js-only data-copy="${escapeHtml(f.start)}" aria-label="Copy ${escapeHtml(f.start)}">Copy</button>
        </div>
        <p class="home-feature-links"><a href="${docs}">Docs<span class="visually-hidden"> for ${escapeHtml(f.title)}</span></a> <span aria-hidden="true">·</span> <a href="${href}">Features<span class="visually-hidden">: ${escapeHtml(f.title)}</span></a></p>
      </li>`;
  }).join("\n      ");

  const steps = quickstart.map((s, i) => `<li class="home-step">
        <span class="home-step-n" aria-hidden="true">${i + 1}</span>
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${s.body}</p>
          ${s.cmd ? cmdBlock(s.cmd) : ""}
        </div>
      </li>`).join("\n      ");

  const strip = statStrip([
    { label: "Servers", value: `<span data-live="guilds">${fmtNum(stats.guilds)}</span>`, note: "using Aegis now" },
    { label: "Commands", value: `<a href="/commands">${cs.commands}</a>`, note: `in ${cs.categories} categories` },
    { label: "Subcommands", value: `${fmtNum(cs.subcommands)}`, note: `${fmtNum(cs.options)} options` },
    latest && latest.date
      ? { label: "Latest release", value: `<a href="/changelog#${escapeHtml(latest.id)}">v${escapeHtml(latest.version)}</a>`, note: `<time datetime="${escapeHtml(latest.date)}">${escapeHtml(fmtDate(latest.date))}</time>` }
      : { label: "Version", value: `v${escapeHtml(cfg.version)}` },
  ], "Aegis in numbers");

  const healthy = st.cls === "ok";
  const body = `${iconSprite()}
<div class="wrap">
  <section class="hero home-hero" aria-labelledby="hero-title">
    <div class="home-hero-text">
      <a class="live-pill" href="/status">
        <span class="dot${healthy ? "" : " danger"}" data-status-dot aria-hidden="true"></span>
        <span data-status-state>${escapeHtml(st.label)}</span>
        <span class="live-pill-sep" aria-hidden="true">·</span>
        <span>gateway <span data-live="ping" data-suffix=" ms">${fmtNum(stats.ping)} ms</span></span>
        <span class="live-pill-sep" aria-hidden="true">·</span>
        <span>up <span data-uptime-from="${Math.max(0, Math.floor(stats.uptime))}">${escapeHtml(fmtUptime(stats.uptime))}</span></span>
      </a>
      <p class="eyebrow">Moderation that keeps up with your community</p>
      <h1 id="hero-title">Moderation for Discord that shows its work.</h1>
      <p class="lead">Aegis handles warnings, timeouts, bans and the case log behind them, plus automod, raid response, ban appeals, tickets, verification and logging. You run it with slash commands in your server, and server managers can review cases and change settings in the <a href="/dashboard">web dashboard</a>.</p>
      <div class="btn-row">
        <a class="btn" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
        <a class="btn ghost" href="/dashboard">Open the dashboard</a>
        <a class="btn ghost" href="/commands">Browse ${cs.commands} commands</a>
      </div>
      <ul class="home-assurances" aria-label="Good to know">
        <li>${icon("check", "f-icon sm")}No Administrator permission</li>
        <li>${icon("check", "f-icon sm")}Free, nothing locked</li>
        <li>${icon("check", "f-icon sm")}Records expire after a year</li>
      </ul>
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
        ${slashInput("trust user", [["user", "@quickcash99"]])}
      </div>
      <p class="hero-caption">Simplified example. The names are made up; the fields match the real reply.</p>
    </div>
  </section>

  ${strip}
  ${whatsNewStrip()}
</div>

${differentiators()}

<div class="section"><div class="wrap">
  ${botShowcase({ id: "proof", title: "See what it actually says", lead: "Two real replies, recreated: a Trust Score with every point explained, and Incident Mode switched on during a raid. The names are made up." })}
</div></div>

${audienceSplit()}

<section class="section" aria-labelledby="highlights-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="highlights-title">Built for the bad days</h2>
      <p>The parts that matter most when a server is under pressure.</p>
    </div>
    <ul class="home-highlights">
      ${highlights}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="what-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="what-title">Everything it does</h2>
      <p>Each card links to its section in the <a href="/docs">docs</a> and on the <a href="/features">features page</a>. The command is where you would start.</p>
    </div>
    <ul class="home-features">
      ${featureCards}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="setup-title">
  <div class="wrap two-col home-setup">
    <div>
      <div class="section-head">
        <h2 id="setup-title">Set up in about five minutes</h2>
        <p>The <a href="/docs#quickstart">quickstart</a> has the longer version. What's coming next is on the <a href="/roadmap">roadmap</a>.</p>
      </div>
      <ol class="home-steps">
      ${steps}
      </ol>
    </div>
    <div>
      <div class="section-head">
        <h2 id="know-title">Good to know</h2>
        <p>The reasoning behind each of these is on <a href="/why">Why Aegis</a>.</p>
      </div>
      <ul class="notes home-notes" aria-labelledby="know-title">
        <li><strong>No Administrator.</strong> The invite asks only for the permissions its commands use. You can read the <a href="/docs#permissions">full list</a> before inviting.</li>
        <li><strong>Role order matters.</strong> Discord will not let a bot act on someone whose top role is above its own. Drag the Aegis role above the roles it should moderate.</li>
        <li><strong>Records expire.</strong> Warnings, cases and staff notes are deleted after a year.</li>
        <li><strong>Per-server data.</strong> Nothing is shared between servers. See the <a href="/privacy">privacy policy</a>.</li>
        <li><strong>Free.</strong> No paid tier, no locked features.</li>
        <li><strong>Open to read.</strong> Every command on the <a href="/commands">commands page</a> is generated from the bot's own definitions.</li>
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
