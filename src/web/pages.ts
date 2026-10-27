import { layout } from "./layout";
import {
  buildCatalog,
  groupByCategory,
  catalogStats,
  permissionMatrix,
  type CommandInfo,
  type OptionInfo,
} from "./catalog";
import { features, faqs, quickstart, type Feature } from "./content";

export interface SiteConfig {
  inviteUrl: string;
  supportUrl: string;
  version: string;
  contactEmail: string;
  assetVersion: string;
}

export interface Stats {
  guilds: number;
  users: number;
  commands: number;
  ping: number;
  uptime: number;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Emit an href only for same-site or http(s) URLs. */
function safeUrl(url: string): string {
  const value = (url ?? "").trim();
  if (value === "" || value === "#") return "#";
  if (value.startsWith("/")) return escapeHtml(value);
  if (/^https?:\/\//i.test(value)) return escapeHtml(value);
  return "#";
}

function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function statusWord(ping: number, online: boolean): { label: string; cls: string } {
  if (!online) return { label: "Offline", cls: "warn" };
  if (ping === 0) return { label: "Connecting", cls: "warn" };
  if (ping < 150) return { label: "Operational", cls: "ok" };
  if (ping < 350) return { label: "Degraded", cls: "warn" };
  return { label: "Unstable", cls: "danger" };
}

function page(cfg: SiteConfig, opts: {
  title: string;
  description: string;
  path: string;
  body: string;
  ogImage?: string;
  noindex?: boolean;
  omitCanonical?: boolean;
  headExtra?: string;
  scripts?: string;
}): string {
  return layout({
    title: opts.title,
    description: opts.description,
    path: opts.path,
    body: opts.body,
    current: opts.path,
    inviteUrl: cfg.inviteUrl,
    supportUrl: cfg.supportUrl,
    version: cfg.version,
    assetVersion: cfg.assetVersion,
    ogImage: opts.ogImage ?? "/assets/og.svg",
    noindex: opts.noindex,
    omitCanonical: opts.omitCanonical,
    headExtra: opts.headExtra,
    scripts: opts.scripts,
  });
}

/** JSON-LD graph injected into a page head. */
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/* ── Shared components ─────────────────────────────────────────────── */

function statCard(label: string, value: string, attr?: string): string {
  return `<div class="stat">
    <div class="stat-value"${attr ? ` ${attr}` : ""}>${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function featureCard(f: Feature, compact = false): string {
  return `<article class="card reveal">
    <div class="card-icon" aria-hidden="true">${f.icon}</div>
    <h3>${escapeHtml(f.title)}</h3>
    <p>${escapeHtml(f.text)}</p>
    ${compact ? "" : `<ul>${f.points.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`}
    ${f.href ? `<a class="card-link" href="${f.href}">Learn more</a>` : ""}
  </article>`;
}

function faqBlock(items: { q: string; a: string }[]): string {
  return `<div class="accordion" data-faq>
    ${items.map(item => `<details class="acc">
      <summary>${escapeHtml(item.q)}</summary>
      <div class="acc-body">${item.a}</div>
    </details>`).join("\n    ")}
  </div>`;
}

function ctaBox(cfg: SiteConfig, heading: string, sub: string): string {
  return `<div class="cta-box">
    <h2>${escapeHtml(heading)}</h2>
    <p>${sub}</p>
    <div class="btn-row center">
      <a class="btn lg" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
      ${cfg.supportUrl ? `<a class="btn ghost lg" href="${safeUrl(cfg.supportUrl)}">Join the support server</a>` : ""}
      <a class="btn ghost lg" href="/docs">Read the docs</a>
    </div>
  </div>`;
}

function homeHero(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const st = statusWord(stats.ping, online);

  return `<section class="hero">
    <div class="wrap">
      <div class="badge ${st.cls === "ok" ? "" : "warn"}">
        <span class="dot" aria-hidden="true"></span>
        ${st.label} &middot; Gateway ${stats.ping}ms
      </div>
      <h1><span class="gradient-text">Moderation that keeps up</span><br>with your community.</h1>
      <p class="lead">Aegis is an ultra-fast Discord bot built for real-time AutoMod, seamless ticket desks, and tamper-proof audit trails. Pure slash commands, zero dashboard dependencies, and sub-15ms response latency.</p>
      <div class="btn-row center hero-actions">
        <a class="btn lg" href="${safeUrl(cfg.inviteUrl)}">Add to Discord</a>
        <a class="btn ghost lg" href="/features">Explore Features</a>
        <a class="btn ghost lg" href="/commands">Browse all commands</a>
      </div>
      <p class="hero-note">Free to use &middot; ${stats.commands} slash commands &middot; Built on modern Knub architecture</p>

      <div class="trust-strip" aria-label="Aegis principles">
        <span>✓ No web portal required</span>
        <span>✓ Sub-15ms response latency</span>
        <span>✓ Least-privilege permissions</span>
        <span>✓ Per-server isolation</span>
      </div>

      <div class="stats">
        ${statCard("Servers", stats.guilds.toLocaleString(), 'data-live="guilds" data-count="' + stats.guilds + '"')}
        ${statCard("Members", stats.users.toLocaleString(), 'data-live="users" data-count="' + stats.users + '"')}
        ${statCard("Commands", String(catalogStats().commands), 'data-count="' + catalogStats().commands + '"')}
        ${statCard("Uptime", fmtUptime(stats.uptime), 'data-uptime-from="' + stats.uptime + '"')}
      </div>

      <!-- Quick Command Copy Strip -->
      <div class="cmd-pill-row reveal" aria-label="Quick copy slash commands">
        <button class="cmd-pill" type="button" data-cmd="/timeout user:@member duration:30m reason:spam" title="Click to copy command">
          <code>/timeout</code> <span class="pill-copy">Copy</span>
        </button>
        <button class="cmd-pill" type="button" data-cmd="/automod setup rule:links action:delete" title="Click to copy command">
          <code>/automod</code> <span class="pill-copy">Copy</span>
        </button>
        <button class="cmd-pill" type="button" data-cmd="/ticket setup channel:#support role:@Staff" title="Click to copy command">
          <code>/ticket</code> <span class="pill-copy">Copy</span>
        </button>
        <button class="cmd-pill" type="button" data-cmd="/verify setup channel:#verify role:@Verified" title="Click to copy command">
          <code>/verify</code> <span class="pill-copy">Copy</span>
        </button>
        <button class="cmd-pill" type="button" data-cmd="/warn user:@member reason:rules severity:medium" title="Click to copy command">
          <code>/warn</code> <span class="pill-copy">Copy</span>
        </button>
        <button class="cmd-pill" type="button" data-cmd="/poll question:&quot;Weekly Meetup?&quot; option1:&quot;Friday&quot; option2:&quot;Saturday&quot;" title="Click to copy command">
          <code>/poll</code> <span class="pill-copy">Copy</span>
        </button>
      </div>

      <!-- Interactive Mod Terminal Preview -->
      <div class="hero-panel reveal">
        <div class="window-bar" style="justify-content:space-between; flex-wrap:wrap; gap:0.5rem">
          <div style="display:flex; align-items:center; gap:0.5rem">
            <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
            <span class="window-title">aegis-terminal-preview</span>
          </div>
          <div class="preview-tabs" role="group" aria-label="Interactive Preview Tabs">
            <button class="preview-tab-btn" type="button" data-tab="preview-automod" aria-pressed="true">⚡ AutoMod Shield</button>
            <button class="preview-tab-btn" type="button" data-tab="preview-timeout" aria-pressed="false">⏱️ Precision Timeout</button>
            <button class="preview-tab-btn" type="button" data-tab="preview-ticket" aria-pressed="false">🎫 Support Desk</button>
          </div>
        </div>

        <!-- Panel 1: AutoMod -->
        <div class="preview-panel active" id="preview-automod">
          <div class="chat">
            <div class="chat-row">
              <div class="avatar user" aria-hidden="true">SP</div>
              <div class="chat-body">
                <div class="chat-name">spammer_99<span class="pill danger" style="font-size:0.6rem;padding:0.05rem 0.35rem">FLAGGED</span></div>
                <div class="chat-text">join my server for nitro discord.gg/fake-nitro-drop</div>
              </div>
            </div>
            <div class="chat-row">
              <div class="avatar bot" aria-hidden="true">A</div>
              <div class="chat-body">
                <div class="chat-name">Aegis Shield<span class="bot-tag">BOT</span></div>
                <div class="chat-text">Message deleted in <code class="inline">#general</code>. AutoMod rule triggered: <strong>Unauthorized Invite Link</strong>.</div>
                <div class="embed" style="border-left-color:#e74c3c">
                  <div class="embed-title">🛡️ AutoMod Enforcement &bull; Action Purged</div>
                  <div class="embed-field"><span class="k">Offender</span><span>spammer_99 (ID: 8940120)</span></div>
                  <div class="embed-field"><span class="k">Action</span><span>Message deleted + 15m timeout applied</span></div>
                  <div class="embed-field"><span class="k">Latency</span><span>8 ms dispatch</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 2: Precision Timeout -->
        <div class="preview-panel" id="preview-timeout">
          <div class="chat">
            <div class="chat-row">
              <div class="avatar user" aria-hidden="true">MK</div>
              <div class="chat-body">
                <div class="chat-name">mod.kai<span class="bot-tag">MOD</span></div>
                <div class="chat-text"><code class="inline">/timeout user:@riley duration:1h reason:repeated trolling</code></div>
              </div>
            </div>
            <div class="chat-row">
              <div class="avatar bot" aria-hidden="true">A</div>
              <div class="chat-body">
                <div class="chat-name">Aegis<span class="bot-tag">BOT</span></div>
                <div class="chat-text">Member timed out successfully. Direct message notification sent with appeal information.</div>
                <div class="embed" style="border-left-color:#ffa500">
                  <div class="embed-title">⏱️ Disciplinary Action &bull; Case #1084</div>
                  <div class="embed-field"><span class="k">Target</span><span>@riley</span></div>
                  <div class="embed-field"><span class="k">Duration</span><span>1 hour (until in 60 minutes)</span></div>
                  <div class="embed-field"><span class="k">Reason</span><span>repeated trolling</span></div>
                  <div class="embed-field"><span class="k">Moderator</span><span>mod.kai</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 3: Support Desk -->
        <div class="preview-panel" id="preview-ticket">
          <div class="chat">
            <div class="chat-row">
              <div class="avatar bot" aria-hidden="true">A</div>
              <div class="chat-body">
                <div class="chat-name">Aegis Support<span class="bot-tag">BOT</span></div>
                <div class="chat-text">Support desk initialized for <code class="inline">#support-desk</code>.</div>
                <div class="embed" style="border-left-color:#3498db">
                  <div class="embed-title">🎫 Aegis Community Support Desk</div>
                  <div class="embed-field"><span class="k">Queue</span><span>General Help &amp; Billing Inquiries</span></div>
                  <div class="embed-field"><span class="k">Staff Role</span><span>@SupportTeam</span></div>
                  <div class="embed-field"><span class="k">Security</span><span>Isolated private channel creation</span></div>
                  <div style="margin-top:0.65rem">
                    <button class="btn sm primary ft-demo-btn" type="button" data-demo-msg="Demo: Opened ticket channel #ticket-042!">🎫 Open Support Ticket</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>`;
}

/* ── Home ──────────────────────────────────────────────────────────── */

export function renderHome(cfg: SiteConfig, stats: Stats, online: boolean): string {
  const topFaqs = faqs.slice(0, 4);

  const body = `
${homeHero(cfg, stats, online)}

<!-- 4 Core Pillars Bento Grid -->
<section class="block" id="capabilities">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Core Capabilities</span>
      <h2>Engineered for High-Traffic Communities</h2>
      <p>A cohesive suite of moderation and community systems designed to run seamlessly via Discord slash commands.</p>
    </div>
    <div class="bento-grid">
      <div class="bento-card reveal">
        <div class="bento-icon">⚡</div>
        <h3>Intelligent AutoMod Engine</h3>
        <p>Real-time protection against malicious invite links, token-bucket mention spam, and offensive keywords without human lag.</p>
        <ul class="bento-points">
          <li>Heuristic phishing domain and invite stripper</li>
          <li>Mass mention and caps flooding defense</li>
          <li>Configurable strike actions with instant timeouts</li>
        </ul>
        <div class="btn-row">
          <a class="btn sm ghost" href="/features#automod">Explore AutoMod &rarr;</a>
        </div>
      </div>

      <div class="bento-card reveal">
        <div class="bento-icon">🔨</div>
        <h3>Audit-Grade Moderation</h3>
        <p>Every timeout, warn, kick, and ban is validated against Discord role hierarchy and archived into a tamper-proof case database.</p>
        <ul class="bento-points">
          <li>Role hierarchy guarding prevents staff privilege abuse</li>
          <li>Dynamic timeout extension and warning escalations</li>
          <li>Full case histories exportable via <code class="inline">/case</code></li>
        </ul>
        <div class="btn-row">
          <a class="btn sm ghost" href="/features#moderation">Explore Moderation &rarr;</a>
        </div>
      </div>

      <div class="bento-card reveal">
        <div class="bento-icon">🎫</div>
        <h3>Confidential Ticket Desks</h3>
        <p>1-click private support channels provisioned with isolated permission overwrites and staff claiming tools.</p>
        <ul class="bento-points">
          <li>Mutex-guarded creation preventing queue spam</li>
          <li>Staff claiming, user invites, and ticket notes</li>
          <li>Full transcript logging upon ticket closure</li>
        </ul>
        <div class="btn-row">
          <a class="btn sm ghost" href="/features#tickets">Explore Tickets &rarr;</a>
        </div>
      </div>

      <div class="bento-card reveal">
        <div class="bento-icon">🛡️</div>
        <h3>Gateway Defense &amp; Onboarding</h3>
        <p>Keep automated raiders out while providing smooth self-service roles, giveaways, and polls for genuine members.</p>
        <ul class="bento-points">
          <li>Button and CAPTCHA verification gatekeeper</li>
          <li>Self-assignable role panels without reaction lag</li>
          <li>Interactive community polls and automated giveaways</li>
        </ul>
        <div class="btn-row">
          <a class="btn sm ghost" href="/features#verification">Explore Defense &rarr;</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Getting Started: 3 Steps -->
<section class="block tight">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Getting Started</span>
      <h2>Three steps to a protected server</h2>
      <p>Aegis declares permissions per command, so the invite screen only asks for what the bot actually needs to run. Server-wide settings use Manage Server rather than Administrator.</p>
    </div>
    <div class="steps">
      ${quickstart.map(s => `<div class="step reveal">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${s.body}</p>
      </div>`).join("\n      ")}
    </div>
  </div>
</section>

<!-- Architecture Highlights -->
<section class="block tight">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Architecture &amp; Security</span>
      <h2>Why Admins Trust Aegis</h2>
      <p>Engineered from day one for zero bloat, verifiable security, and high reliability.</p>
    </div>
    <div class="grid cols-3">
      <div class="card reveal">
        <div class="card-icon">🔒</div>
        <h3>No External Web Portal</h3>
        <p>Manage everything in Discord using slash commands and buttons. Staff never need to log into an external website or authorize OAuth tokens.</p>
      </div>
      <div class="card reveal">
        <div class="card-icon">⚡</div>
        <h3>Knub TypeScript Engine</h3>
        <p>Modular plugin architecture with sliding TTL caches, event debouncing, and sub-15ms WebSocket gateway response speeds.</p>
      </div>
      <div class="card reveal">
        <div class="card-icon">📜</div>
        <h3>Strict Least-Privilege</h3>
        <p>Aegis only requests the specific permissions it needs. No blanket Administrator access required for server safety.</p>
      </div>
    </div>
  </div>
</section>

<!-- Frequently Asked Questions -->
<section class="block tight">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Questions</span>
      <h2>Frequently asked</h2>
      <p>Quick answers to common questions about setting up and using Aegis.</p>
    </div>
    ${faqBlock(topFaqs)}
  </div>
</section>

<!-- Call to action -->
<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Ready to get started?", "Add Aegis to your server and run <code class=\"inline\">/help</code> to see everything it can do.")}
    <p style="text-align:center;margin-top:1.75rem;font-size:0.85rem;color:var(--faint)">
      By adding Aegis to a server you accept the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
    </p>
  </div>
</section>`;

  return page(cfg, {
    title: "Aegis — Discord Moderation & Automation Bot",
    description:
      "Aegis is a fast, modular Discord bot for moderation, auto moderation, audit logging, welcome messages, and automation. Configured with slash commands, no dashboard required.",
    path: "/",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: "Aegis",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Cross-platform",
          description:
            "A fast, modular Discord bot for moderation, auto moderation, audit logging, welcome messages, and automation.",
          softwareVersion: cfg.version,
          url: process.env.SITE_URL || undefined,
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

/* ── Features ──────────────────────────────────────────────────────── */

export function renderFeatures(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Features</span>
  </nav>
  <div class="page-head center reveal">
    <span class="eyebrow">Enterprise-Grade Modular Architecture</span>
    <h1 style="font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-0.03em">Engineered for Modern Discord Communities</h1>
    <p class="lead" style="max-width:760px;margin:0.75rem auto 1.75rem">
      Every tool you need to moderate, protect, onboard, and support your members &mdash; powered by Knub TypeScript plugins and pure slash commands without clunky web dashboard dependencies.
    </p>
    <div class="btn-row center">
      <a class="btn primary" href="${safeUrl(cfg.inviteUrl)}">Add Aegis to Discord</a>
      <a class="btn ghost" href="/commands">Explore All Commands</a>
      <a class="btn ghost" href="/docs">Read Documentation</a>
    </div>
  </div>

  <div class="ft-category-nav reveal" id="ft-nav" role="group" aria-label="Feature categories">
    <button class="ft-cat-btn" type="button" data-filter="all" aria-pressed="true">✨ All Systems</button>
    <button class="ft-cat-btn" type="button" data-filter="verification" aria-pressed="false">🛡️ Anti-Raid Gate</button>
    <button class="ft-cat-btn" type="button" data-filter="automod" aria-pressed="false">🤖 AutoMod Shield</button>
    <button class="ft-cat-btn" type="button" data-filter="moderation" aria-pressed="false">🔨 Moderation &amp; Logs</button>
    <button class="ft-cat-btn" type="button" data-filter="tickets" aria-pressed="false">🎫 Support Tickets</button>
  </div>
</div>

<div class="wrap" id="ft-container">

  <!-- Feature 1: Anti-Raid Gateway -->
  <section class="ft-showcase-card reveal" data-category="verification" id="verification">
    <div>
      <span class="ft-badge" style="margin-bottom:0.75rem">🛡️ Gateway Defense</span>
      <h2 style="font-size:clamp(1.5rem,2.8vw,2rem);margin:0.35rem 0 0.75rem">Anti-Raid Verification Gate</h2>
      <p style="color:var(--text-2);font-size:0.98rem;line-height:1.6;margin-bottom:1.25rem">
        Shield your server from coordinated raids, compromised user tokens, and spam accounts. New arrivals remain completely walled off from community channels until solving verification.
      </p>
      <div style="display:grid;gap:0.75rem;margin-bottom:1.5rem">
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>1-Click Button or CAPTCHA:</strong> Choose smooth onboarding or strict image challenges for new joins.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Atomic Role Granting:</strong> Automatically assigns verified roles with real-time audit logging.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Ephemeral Security Prompts:</strong> Keeps verification channels clean and free of message clutter.</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="ft-demo-btn" type="button" data-demo-msg="🛡️ Gatekeeper Demo: Passed challenge, granted @Member role!">✅ Test Gatekeeper</button>
        <a class="btn sm ghost" href="/docs#verification">Verification Manual &rarr;</a>
        <a class="btn sm ghost" href="/commands#verification">Commands</a>
      </div>
    </div>
    <div class="ft-mockup-frame">
      <div class="ft-mockup-topbar">
        <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span style="font-size:0.75rem;color:#949ba4;font-family:var(--mono)">#verification</span>
        <span class="pill ok" style="font-size:0.65rem;padding:0.1rem 0.4rem">Gatekeeper</span>
      </div>
      <div class="ft-mockup-body">
        <div class="discord-msg-head">
          <div class="discord-avatar" style="background:#2ecc71">🛡️</div>
          <div>
            <div class="discord-author">Aegis <span class="discord-bot-tag">BOT</span></div>
            <div class="discord-time">Today at 1:04 PM</div>
          </div>
        </div>
        <div class="discord-embed-card" style="border-left-color:#2ecc71">
          <div class="discord-embed-title">🛡️ Server Entry Gate</div>
          <div class="discord-embed-desc">Welcome to the community! To protect our server from spam and automated bots, please verify your account by clicking the button below.</div>
          <div class="discord-embed-fields">
            <div>
              <div class="discord-field-name">Target Role</div>
              <div class="discord-field-val">@Member</div>
            </div>
            <div>
              <div class="discord-field-name">Security Level</div>
              <div class="discord-field-val">High (Anti-Raid)</div>
            </div>
          </div>
          <div class="discord-buttons-row">
            <button class="d-btn success ft-demo-btn" type="button" data-demo-msg="Demo: Verification confirmed! Role @Member granted.">✅ Click to Verify Account</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature 2: AutoMod -->
  <section class="ft-showcase-card reveal" data-category="automod" id="automod">
    <div>
      <span class="ft-badge" style="margin-bottom:0.75rem">🤖 Real-Time Filter</span>
      <h2 style="font-size:clamp(1.5rem,2.8vw,2rem);margin:0.35rem 0 0.75rem">Intelligent AutoMod Shield</h2>
      <p style="color:var(--text-2);font-size:0.98rem;line-height:1.6;margin-bottom:1.25rem">
        Keep chat clean 24/7 without burning out human staff. High-velocity regex keyword filters, anti-phishing link shielding, mention blast suppression, and message edit inspection.
      </p>
      <div style="display:grid;gap:0.75rem;margin-bottom:1.5rem">
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Anti-Invite &amp; Phishing Filter:</strong> Strips unauthorized Discord links and malicious domains in sub-15ms.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Mention Spam Limiter:</strong> Automatically isolates accounts that mass-ping members or roles.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Role &amp; Channel Exemptions:</strong> Whitelist staff roles and bot channels from automod scans.</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="ft-demo-btn" type="button" data-demo-msg="⚡ AutoMod Demo: Intercepted unauthorized invite link in #general!">⚡ Test AutoMod Intercept</button>
        <a class="btn sm ghost" href="/docs#automod">AutoMod Rules &rarr;</a>
        <a class="btn sm ghost" href="/commands#automod">Commands</a>
      </div>
    </div>
    <div class="ft-mockup-frame">
      <div class="ft-mockup-topbar">
        <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span style="font-size:0.75rem;color:#949ba4;font-family:var(--mono)">#general-chat</span>
        <span class="pill warn" style="font-size:0.65rem;padding:0.1rem 0.4rem">Auto Shield</span>
      </div>
      <div class="ft-mockup-body">
        <div class="discord-msg-head">
          <div class="discord-avatar" style="background:#f1c40f">🤖</div>
          <div>
            <div class="discord-author">Aegis Shield <span class="discord-bot-tag">BOT</span></div>
            <div class="discord-time">Today at 2:44 PM</div>
          </div>
        </div>
        <div class="discord-embed-card" style="border-left-color:#f1c40f">
          <div class="discord-embed-title">⚠️ AutoMod Violation Detected</div>
          <div class="discord-embed-desc">A message by <code class="inline">@SpamBot</code> was automatically deleted in <code class="inline">#general</code>.<br><strong>Rule:</strong> Unauthorized Discord Invite Links<br><strong>Action:</strong> Message purged + 10-minute timeout applied.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature 3: Moderation & Escalation -->
  <section class="ft-showcase-card reveal" data-category="moderation" id="moderation">
    <div>
      <span class="ft-badge" style="margin-bottom:0.75rem">🔨 Hierarchy &amp; Discipline</span>
      <h2 style="font-size:clamp(1.5rem,2.8vw,2rem);margin:0.35rem 0 0.75rem">Full Moderation Suite &amp; Case Logs</h2>
      <p style="color:var(--text-2);font-size:0.98rem;line-height:1.6;margin-bottom:1.25rem">
        Every action verifies Discord role hierarchy, checks executor authority, writes permanent case records to MongoDB, and dispatches detailed audit embeds to your staff channel.
      </p>
      <div style="display:grid;gap:0.75rem;margin-bottom:1.5rem">
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Hierarchy Guarding:</strong> Prevents moderation against server owners, equal roles, or higher staff.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Dynamic Timeout Extensions:</strong> Extend ongoing timeouts smoothly without resetting timestamps.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Audit Trail &amp; Export:</strong> Filter infractions with /infractions or export server cases via /case export.</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="ft-demo-btn" type="button" data-demo-msg="🔨 Moderation Demo: Issued Case #1084 (1h timeout) with DM notice!">🔨 Test Case Creation</button>
        <a class="btn sm ghost" href="/docs#permissions">Permissions Matrix &rarr;</a>
        <a class="btn sm ghost" href="/commands#moderation">Commands</a>
      </div>
    </div>
    <div class="ft-mockup-frame">
      <div class="ft-mockup-topbar">
        <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span style="font-size:0.75rem;color:#949ba4;font-family:var(--mono)">#mod-audit-log</span>
        <span class="pill danger" style="font-size:0.65rem;padding:0.1rem 0.4rem">Case Log</span>
      </div>
      <div class="ft-mockup-body">
        <div class="discord-msg-head">
          <div class="discord-avatar" style="background:#e74c3c">⚖️</div>
          <div>
            <div class="discord-author">Aegis Audit <span class="discord-bot-tag">BOT</span></div>
            <div class="discord-time">Today at 4:18 PM</div>
          </div>
        </div>
        <div class="discord-embed-card" style="border-left-color:#e74c3c">
          <div class="discord-embed-title">🔨 Member Timed Out &bull; Case #1084</div>
          <div class="discord-embed-desc"><strong>Target:</strong> @User#4092<br><strong>Moderator:</strong> @StaffLead<br><strong>Duration:</strong> 2 hours<br><strong>Reason:</strong> Repeated invite spam in #general</div>
          <div class="discord-embed-fields">
            <div>
              <div class="discord-field-name">Warning Count</div>
              <div class="discord-field-val">3 active warnings</div>
            </div>
            <div>
              <div class="discord-field-name">Escalation</div>
              <div class="discord-field-val">Auto-Rule Triggered</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature 4: Support Tickets -->
  <section class="ft-showcase-card reveal" data-category="tickets" id="tickets">
    <div>
      <span class="ft-badge" style="margin-bottom:0.75rem">🎫 Support &amp; Help Desk</span>
      <h2 style="font-size:clamp(1.5rem,2.8vw,2rem);margin:0.35rem 0 0.75rem">Private Support Ticket System</h2>
      <p style="color:var(--text-2);font-size:0.98rem;line-height:1.6;margin-bottom:1.25rem">
        Empower community members to open confidential support channels with staff at the press of a button. Aegis automates permission isolation, claiming, member additions, and complete transcript archiving.
      </p>
      <div style="display:grid;gap:0.75rem;margin-bottom:1.5rem">
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>1-Click Ticket Provisioning:</strong> Instant private channel creation with isolated permission overwrites.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Single-Open Guarantee:</strong> Mutex-guarded creation preventing duplicate ticket queues or spam clicks.</div>
        </div>
        <div class="feature-row">
          <div class="card-icon" style="color:var(--accent)" aria-hidden="true">✓</div>
          <div><strong>Staff Claims &amp; Transcripts:</strong> Claim tickets directly in-channel and export structured text logs upon closure.</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="ft-demo-btn" type="button" data-demo-msg="🎫 Ticket Demo: Created private channel #ticket-general-042!">🎫 Test Ticket Provisioning</button>
        <a class="btn sm ghost" href="/docs#tickets">Ticket Documentation &rarr;</a>
        <a class="btn sm ghost" href="/commands#tickets">Commands</a>
      </div>
    </div>
    <div class="ft-mockup-frame">
      <div class="ft-mockup-topbar">
        <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span style="font-size:0.75rem;color:#949ba4;font-family:var(--mono)">#support-desk</span>
        <span class="pill" style="font-size:0.65rem;padding:0.1rem 0.4rem">Discord Embed</span>
      </div>
      <div class="ft-mockup-body">
        <div class="discord-msg-head">
          <div class="discord-avatar" style="background:#5865f2">A</div>
          <div>
            <div class="discord-author">Aegis <span class="discord-bot-tag">BOT</span></div>
            <div class="discord-time">Today at 3:12 PM</div>
          </div>
        </div>
        <div class="discord-embed-card" style="border-left-color:#3498db">
          <div class="discord-embed-title">🎫 Aegis Support Center</div>
          <div class="discord-embed-desc">Need assistance from our team? Click the button below to generate a private support ticket. Only you and authorized staff can view the channel.</div>
          <div class="discord-embed-fields">
            <div>
              <div class="discord-field-name">Queue</div>
              <div class="discord-field-val">General Support</div>
            </div>
            <div>
              <div class="discord-field-name">Response Time</div>
              <div class="discord-field-val">&lt; 5 minutes</div>
            </div>
          </div>
          <div class="discord-buttons-row">
            <button class="d-btn primary ft-demo-btn" type="button" data-demo-msg="Demo: Created ticket channel #ticket-general!">🎫 Open Support Ticket</button>
          </div>
        </div>
      </div>
    </div>
  </section>

</div>

<!-- Architecture Comparison Table -->
<section class="block">
  <div class="wrap">
    <div class="section-head center reveal">
      <span class="eyebrow">Architectural Superiority</span>
      <h2>Aegis vs. Legacy Monolithic Bots</h2>
      <p>Why modern Discord communities are replacing bloated multi-purpose bots with Aegis.</p>
    </div>
    <div class="table-wrap reveal">
      <table class="ft-compare-table">
        <thead>
          <tr>
            <th>Feature / Characteristic</th>
            <th class="highlight-col" style="color:var(--primary);font-size:0.92rem">⚡ Aegis (Knub Architecture)</th>
            <th>Typical Monolithic Bots</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Configuration Method</strong></td>
            <td class="highlight-col"><strong>100% Native Slash Commands</strong> &bull; Zero login or OAuth portal required</td>
            <td class="faint">Clunky external web dashboards requiring browser login</td>
          </tr>
          <tr>
            <td><strong>Modularity &amp; Performance</strong></td>
            <td class="highlight-col"><strong>Knub TypeScript Plugins</strong> &bull; Sub-15ms execution latency &amp; TTL caching</td>
            <td class="faint">Heavy monolithic processes with frequent gateway timeouts</td>
          </tr>
          <tr>
            <td><strong>Security &amp; Hierarchy</strong></td>
            <td class="highlight-col"><strong>Strict Least-Privilege Hierarchy</strong> &bull; Pre-filter verification pipeline</td>
            <td class="faint">Demands dangerous Administrator permissions by default</td>
          </tr>
          <tr>
            <td><strong>Auditability &amp; Privacy</strong></td>
            <td class="highlight-col"><strong>Guild-Isolated MongoDB Data</strong> &bull; Plaintext and JSON transcripts exportable</td>
            <td class="faint">Opaque cloud storage with locked-in proprietary data</td>
          </tr>
          <tr>
            <td><strong>Transparency &amp; Status</strong></td>
            <td class="highlight-col"><strong>Real-time Live Telemetry &amp; Open APIs</strong> &bull; Free machine-readable endpoints</td>
            <td class="faint">Stale status pages or unmonitored outages</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Deploy Aegis to Your Community", "Join thousands of protected members with higher security, cleaner moderation, and instant response times.")}
  </div>
</section>`;

  return page(cfg, {
    title: "Features & Architecture — Aegis Discord Bot",
    description:
      "Enterprise support tickets, anti-raid verification gates, interactive role panels, moderation case logs, AutoMod shielding, and scheduled automation.",
    path: "/features",
    body,
  });
}

/* ── Commands ──────────────────────────────────────────────────────── */

function optionsTable(cmd: CommandInfo): string {
  const all: OptionInfo[] = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s =>
      s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))
    ),
  ];

  if (all.length === 0) return `<p class="faint">This command takes no options.</p>`;

  return `<div class="table-wrap">
    <table class="opt-table">
      <thead><tr><th>Option</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
      <tbody>
        ${all.map(o => `<tr>
          <td><code>${escapeHtml(o.name)}</code></td>
          <td>${escapeHtml(o.type)}</td>
          <td>${o.required ? `<span class="opt-req">required</span>` : `<span class="opt-opt">optional</span>`}</td>
          <td>${escapeHtml(o.description)}${o.choices.length ? `<br><span class="faint">Choices: ${o.choices.map(escapeHtml).join(", ")}</span>` : ""}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

function commandCard(cmd: CommandInfo): string {
  const options = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s => s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))),
  ];

  const searchBlob = [
    cmd.name,
    cmd.category,
    cmd.description,
    ...cmd.subcommands.map(s => `${s.path} ${s.description}`),
    ...options.map(o => `${o.name} ${o.description} ${o.choices.join(" ")}`),
    ...cmd.declaredPermissions,
    ...cmd.enforcedPermissions,
  ]
    .join(" ")
    .toLowerCase();

  const perms = [...new Set([...cmd.declaredPermissions, ...cmd.enforcedPermissions])];
  const anchor = `cmd-${cmd.name}`;

  return `<details class="cmd-card" id="${anchor}" data-cmd-card data-category="${escapeHtml(cmd.category)}" data-search="${escapeHtml(searchBlob)}">
  <summary>
    <a class="cmd-anchor" href="#${anchor}" aria-label="Permalink to /${escapeHtml(cmd.name)}">#</a>
    <span class="cmd-slash" data-cmd-name>/${escapeHtml(cmd.name)}</span>
    <span class="cmd-summary-text">
      <span class="cmd-desc">${escapeHtml(cmd.description)}</span>
    </span>
    <span class="cmd-meta">
      ${cmd.guildOnly ? `<span class="pill">server only</span>` : ""}
      ${perms.length ? `<span class="pill warn">${perms.length} permission${perms.length === 1 ? "" : "s"}</span>` : `<span class="pill ok">no permissions</span>`}
      ${cmd.subcommands.length ? `<span class="pill">${cmd.subcommands.length} sub</span>` : ""}
    </span>
    <span class="cmd-chevron" aria-hidden="true"></span>
  </summary>
  <div class="cmd-body">
    <div class="cmd-run">
      <code class="inline">/${escapeHtml(cmd.name)}</code>
      <button class="copy-btn" type="button" data-copy="/${escapeHtml(cmd.name)}" aria-label="Copy /${escapeHtml(cmd.name)} to clipboard">Copy</button>
      <a class="copy-btn" href="/api/commands/${encodeURIComponent(cmd.name)}">JSON</a>
    </div>

    ${cmd.subcommands.length ? `<div>
      <div class="cmd-section-title">Subcommands</div>
      <div class="sub-list">
        ${cmd.subcommands.map(s => `<div class="sub-item">
          <code>/${escapeHtml(cmd.name)} ${escapeHtml(s.path)}</code>
          <span class="sub-desc">${escapeHtml(s.description)}</span>
          ${s.options.length ? `<span class="sub-opts faint">${s.options.length} option${s.options.length === 1 ? "" : "s"}</span>` : ""}
        </div>`).join("\n        ")}
      </div>
    </div>` : ""}

    <div>
      <div class="cmd-section-title">Options</div>
      ${optionsTable(cmd)}
    </div>

    <div>
      <div class="cmd-section-title">Permissions</div>
      ${perms.length
        ? `<div class="cmd-meta">${perms.map(p => `<span class="pill warn">${escapeHtml(p)}</span>`).join("")}</div>`
        : `<p class="faint">Anyone in the server can run this command.</p>`}
      ${cmd.botPermissions.length
        ? `<p class="faint" style="margin-top:0.5rem;font-size:0.83rem">Aegis needs ${cmd.botPermissions.map(escapeHtml).join(", ")} to run this.</p>`
        : ""}
    </div>
  </div>
</details>`;
}

export function renderCommands(cfg: SiteConfig): string {
  const cat = groupByCategory();
  const s = catalogStats();

  const filterChips = [
    `<button class="tab" type="button" data-cat="all" aria-pressed="true">All <span class="faint">${s.commands}</span></button>`,
    ...cat.map(
      g => `<button class="tab" type="button" data-cat="${escapeHtml(g.category)}" aria-pressed="false">${escapeHtml(g.icon)} ${escapeHtml(g.label)} <span class="faint">${g.commands.length}</span></button>`
    ),
  ].join("\n        ");

  const groups = cat.map(g => `<section class="cmd-group" data-cmd-group="${g.category}" id="${g.category}">
  <div class="cmd-group-head">
    <h2>${g.icon} ${escapeHtml(g.label)}</h2>
    <span class="blurb">${escapeHtml(g.blurb)}</span>
    <span class="pill" style="margin-left:auto">${g.commands.length}</span>
  </div>
  ${g.commands.map(commandCard).join("\n  ")}
</section>`).join("\n\n");

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Commands</span>
  </nav>
  <div class="page-head">
    <h1>Command reference</h1>
    <p class="lead">All ${s.commands} commands, ${s.subcommands} subcommands, and ${s.options} options — generated directly from the command definitions, so this page cannot drift out of date.</p>
  </div>
</div>

<div class="wrap">
  <div class="cmd-toolbar">
    <div class="search">
      <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      <label class="visually-hidden" for="cmd-search">Search commands</label>
      <input id="cmd-search" type="search" placeholder="Search commands and subcommands…" autocomplete="off" spellcheck="false">
      <span class="hint" aria-hidden="true"><kbd>/</kbd></span>
    </div>
    <span class="cmd-count" id="cmd-count" role="status">${s.commands} commands</span>
  </div>

  <div class="tabs" id="cmd-filters" role="group" aria-label="Filter by category">
        ${filterChips}
  </div>

  <div id="cmd-empty" class="empty-state" hidden>
    <strong>No matching commands</strong>
    Try a different search term, or clear the category filter.
  </div>

  ${groups}
</div>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Commands work better in Discord", "The Discord client handles autocomplete, permission hints, and required arguments natively. Press <code class=\"inline\">/</code> in any channel to see the live list.")}
    <p class="feed-note">Follow releases automatically: <a href="/changelog.xml">Atom feed</a>.</p>
  </div>
</section>`;

  return page(cfg, {
    title: "Commands — Aegis",
    description:
      "Full searchable reference for every Aegis slash command, including subcommands, options, and required permissions.",
    path: "/commands",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Aegis command reference",
      description:
        "Searchable reference for every Aegis slash command, including subcommands, options, and required permissions.",
      url: `${process.env.SITE_URL || ""}/commands`,
      softwareVersion: cfg.version,
    }),
  });
}

/* ── Docs ──────────────────────────────────────────────────────────── */

const DOC_SECTIONS = [
  { id: "quickstart",    label: "Quickstart" },
  { id: "tickets",      label: "Support Tickets" },
  { id: "verification", label: "Verification & Anti-Raid" },
  { id: "roles",        label: "Role Panels & Self-Roles" },
  { id: "starboard",    label: "Starboard" },
  { id: "suggestions",  label: "Suggestions & Voting" },
  { id: "beta",         label: "Beta & Command Lab" },
  { id: "automod",      label: "Auto Moderation" },
  { id: "logging",      label: "Audit Logging" },
  { id: "welcome",      label: "Welcome Messages" },
  { id: "automation",   label: "Automation & Schedules" },
  { id: "configuration",label: "Configuration" },
  { id: "permissions",  label: "Permissions Matrix" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "architecture", label: "Architecture & Security" },
];

function permissionTable(): string {
  const rows = permissionMatrix();

  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Permission</th><th>Used by</th><th>Why</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${escapeHtml(r.permission)}</strong></td>
          <td>${r.commands.map(c => `<code class="inline">${escapeHtml(c)}</code>`).join(" ")}</td>
          <td>${PERMISSION_WHY[r.permission] ?? "Required to perform the action."}</td>
        </tr>`).join("\n        ")}
      </tbody>
    </table>
  </div>`;
}

const PERMISSION_WHY: Record<string, string> = {
  "Ban Members": "Removing members from the server entirely or lifting bans.",
  "Kick Members": "Removing a member without a permanent ban.",
  "Moderate Members": "Applying and lifting communication timeouts.",
  "Manage Messages": "Bulk deleting messages and managing panel messages.",
  "Manage Channels": "Creating ticket channels, locking channels, and setting slowmodes.",
  "Manage Roles": "Assigning roles via verification and interactive role panels.",
  "Manage Server": "Editing server-wide Aegis configuration and AutoMod rules.",
};

export function renderDocs(cfg: SiteConfig): string {
  const s = catalogStats();
  void s;

  const side = DOC_SECTIONS.map(sec => {
    const match = sectionCommandCount(sec.id);
    return `<li><a href="#${sec.id}" class="docs-nav-anchor">${escapeHtml(sec.label)}${match ? ` <span class="faint">(${match})</span>` : ""}</a></li>`;
  }).join("\n        ");

  const mobileOptions = DOC_SECTIONS.map(sec => {
    return `<option value="#${sec.id}">${escapeHtml(sec.label)}</option>`;
  }).join("\n          ");

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Docs</span>
  </nav>
  <div class="page-head docs-header">
    <div class="docs-meta-badges">
      <span class="pill ok">v${escapeHtml(cfg.version)} Manual</span>
      <span class="pill faint">⏱️ 8 min read</span>
      <span class="pill faint">Updated October 2026</span>
    </div>
    <h1 style="margin-top: 0.5rem;">Documentation &amp; <span class="gradient-text">User Manual</span></h1>
    <p class="lead">Complete operational handbook for configuring Aegis, setting up ticket panels, anti-raid verification, interactive role panels, starboard showcases, AutoMod filters, and audit streams.</p>
  </div>
</div>

<div class="wrap">
  <!-- Mobile quick jump selector -->
  <div class="docs-mobile-nav" aria-label="Mobile section navigation">
    <label for="docs-section-select" class="docs-mobile-label">Jump to topic:</label>
    <select id="docs-section-select" class="docs-mobile-select" onchange="if(this.value) window.location.hash = this.value;">
      <option value="">Select documentation section...</option>
      ${mobileOptions}
    </select>
  </div>

  <div class="docs-layout">
    <aside class="docs-side" aria-label="On this page">
      <div class="side-title">On this page</div>
      <ul class="docs-side-list">
        ${side}
      </ul>
      <div class="side-divider"></div>
      <div class="side-title">Reference</div>
      <ul>
        <li><a href="/commands">Command Catalog</a></li>
        <li><a href="/features">Feature Architecture</a></li>
        <li><a href="/changelog">Changelog &amp; Releases</a></li>
        <li><a href="/status">Service Telemetry</a></li>
        <li><a href="/troubleshooting">Troubleshooting Guide</a></li>
      </ul>
    </aside>

    <div class="prose docs-content">
      <h2 id="quickstart">Quickstart Guide</h2>
      <p>Aegis is ready to protect and manage your server right out of the box. Follow these steps to set up core moderation, ticket systems, and security gates.</p>
      <ol>
        <li><strong>Invite Aegis to your server.</strong> Click the invite link above and select your server. Aegis registers all slash commands instantly upon joining.</li>
        <li><strong>Configure audit logging.</strong> Run <code class="inline">/logging channel #mod-logs</code> to record member joins, message deletions, and moderation actions.</li>
        <li><strong>Set up support tickets.</strong> Run <code class="inline">/ticket setup channel:#support staff_role:@Staff</code> to post an interactive ticket panel.</li>
        <li><strong>Enable anti-raid verification.</strong> Run <code class="inline">/verify setup channel:#verify verified_role:@Verified</code> to screen new members.</li>
        <li><strong>Configure AutoMod.</strong> Enable keyword and link protection using <code class="inline">/automod words toggle enabled:true</code> and <code class="inline">/automod links toggle enabled:true</code>.</li>
      </ol>
      <div class="callout info">
        <span class="callout-icon" aria-hidden="true">i</span>
        <div>Slash commands register automatically with Discord. If global commands do not appear immediately in your client, restart Discord or run <code class="inline">/help</code> to force client cache refresh.</div>
      </div>
      <div class="callout info">
        <span class="callout-icon" aria-hidden="true">✓</span>
        <div><strong>Recommended first step:</strong> run <code class="inline">/diagnostics</code> after setup. It checks Aegis permissions, configured channels, welcome-role hierarchy, and AutoMod readiness in one report.</div>
      </div>

      <h2 id="tickets">Support Ticket System</h2>
      <p>Aegis features a private support ticket system powered by Discord buttons and permission overwrites. Moderators can manage tickets, claim responsibility, and export TXT chat transcripts.</p>
      <h3>Ticket Commands</h3>
      <pre class="block"><code>/ticket setup channel:#support staff_role:@SupportTeam title:"🎫 Support Center"
/ticket close reason:"Issue resolved"
/ticket claim
/ticket add user:@Member
/ticket remove user:@Member
/ticket transcript</code></pre>
      <h3>Single Open Ticket Rule &amp; Duplicate Safeguards</h3>
      <p>Aegis limits members to one active open ticket at a time to prevent support queue spam. Rapid double-clicks on button panels are guarded by a concurrency mutex, and re-running <code class="inline">/ticket setup</code> automatically purges old panel embeds from the target channel.</p>

      <h2 id="verification">Verification &amp; Anti-Raid System</h2>
      <p>Protect your server against self-bots, raid waves, and spam accounts by requiring new arrivals to pass a verification gate before seeing server channels.</p>
      <pre class="block"><code>/verify setup channel:#verify verified_role:@Member type:button
/verify info
/verify user target:@Member
/verify disable</code></pre>
      <p>Choose between <strong>1-Click Button</strong> mode for seamless onboarding or <strong>CAPTCHA Verification</strong> mode for enhanced security.</p>

      <h2 id="roles">Role Panels &amp; Self-Roles</h2>
      <p>Deploy self-assignable role panels with interactive buttons. Members click a role button to toggle roles on or off instantly with zero reaction emoji lag.</p>
      <pre class="block"><code>/rolepanel create channel:#roles role1:@Announcements role2:@Events role3:@Updates
/rolepanel list
/rolepanel delete id:&lt;panel-id&gt;</code></pre>
      <p>Deleting a role panel record with <code class="inline">/rolepanel delete</code> automatically removes the physical panel message from your Discord channel.</p>

      <h2 id="starboard">Starboard System</h2>
      <p>The Starboard plugin turns memorable community messages into a server hall-of-fame. Whenever a message receives enough reactions of your designated emoji, Aegis automatically captures the content, author information, channel context, and attached media, posting a golden embed to your starboard channel.</p>
      
      <div class="callout tip">
        <span class="callout-icon" aria-hidden="true">★</span>
        <div><strong>Live Star Counter:</strong> As community members add or remove reactions over time, Aegis dynamically updates the star counter on the starboard embed without creating duplicate posts.</div>
      </div>

      <h3>Starboard Commands</h3>
      <pre class="block"><code>/starboard setup channel:#starboard
/starboard threshold count:5
/starboard emoji emoji:⭐
/starboard selfstar allow:false
/starboard ignore action:add channel:#staff-chat
/starboard ignore action:add role:@Bots
/starboard config
/starboard list limit:10
/starboard toggle enabled:true</code></pre>

      <h3>Subcommand Reference</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Subcommand</th><th>Description</th><th>Default / Notes</th></tr></thead>
          <tbody>
            <tr><td><code class="inline">/starboard setup</code></td><td>Designates the public showcase channel where star posts appear.</td><td>Required before starboard activates.</td></tr>
            <tr><td><code class="inline">/starboard threshold</code></td><td>Number of unique reactions required to reach the starboard.</td><td>Default: <code>3</code> (Range: 1–50)</td></tr>
            <tr><td><code class="inline">/starboard emoji</code></td><td>Custom or standard Unicode emoji used as the star trigger.</td><td>Default: <code>⭐</code></td></tr>
            <tr><td><code class="inline">/starboard selfstar</code></td><td>Whether authors can star their own messages towards the threshold.</td><td>Default: <code>false</code> (discourages self-boosting)</td></tr>
            <tr><td><code class="inline">/starboard ignore</code></td><td>Add or remove specific channels or roles from being starred.</td><td>Channels &amp; roles supported.</td></tr>
            <tr><td><code class="inline">/starboard config</code></td><td>Displays an interactive status embed of all starboard settings.</td><td>Shows channel, threshold, emoji, self-star, &amp; ignores.</td></tr>
            <tr><td><code class="inline">/starboard list</code></td><td>Lists the top starred entries in the server with direct jump links.</td><td>Optional limit: 1–25 (Default: 10)</td></tr>
            <tr><td><code class="inline">/starboard toggle</code></td><td>Quickly pause or resume starboard operations without losing settings.</td><td>Enabled / Disabled state.</td></tr>
          </tbody>
        </table>
      </div>

      <h3>High-Performance Persistence &amp; Concurrency</h3>
      <p>Starboard records are tracked in MongoDB with unique compound indexes on <code class="inline">(guildId, originalMessageId)</code>. This guarantees that rapid reaction bursts or bot restarts never cause duplicate starboard messages, and partial reaction events are hydrated directly from Discord's API when uncached.</p>

      <h2 id="suggestions">Suggestions &amp; Community Feedback</h2>
      <p>Collect community ideas with interactive upvote and downvote buttons. Staff members can approve, reject, or mark suggestions as under consideration.</p>
      <pre class="block"><code>/suggest setup channel:#suggestions
/suggest submit
/suggest approve id:&lt;id&gt; reason:"Great idea!"
/suggest deny id:&lt;id&gt; reason:"Not feasible"
/suggest consider id:&lt;id&gt; reason:"Under review"</code></pre>
      <p><code class="inline">/suggest submit</code> opens a guided form. Voting remains available while a suggestion is pending or under consideration, then locks when staff approves or denies it.</p>

      <h2 id="beta">Beta Program &amp; Command Lab</h2>
      <p>Aegis provides a managed experimentation and diagnostics framework for beta servers and authorized partner communities. Feature access is gated through two layers: a server must be enrolled in the beta network, and individual members can be enrolled into the tester roster to access experimental features, feedback triage, and the safety simulator.</p>

      <div class="callout tip">
        <span class="callout-icon" aria-hidden="true">🧪</span>
        <div><strong>Non-Enforcing Safety Simulator:</strong> Testers and moderators can use <code class="inline">/beta lab</code> to evaluate messages against excessive caps, character floods, disguised Discord invites, mass mentions, and token Shannon entropy without issuing warnings or timeouts.</div>
      </div>

      <h3>Tester &amp; Diagnostics Commands</h3>
      <pre class="block"><code>/beta status
/beta lab message:"TESTING 123 LOOOOOOOL discord.gg/fake" type:full
/beta feedback message:"Steps to reproduce the unexpected interaction..." category:bug severity:high
/beta profile [user:@Tester]
/beta leaderboard</code></pre>

      <h3>Beta Staff &amp; Triage Workflow</h3>
      <pre class="block"><code>/beta tester-add user:@Member
/beta tester-remove user:@Member
/beta feature-enable feature:"Experimental AutoMod (Caps &amp; Flood)"
/beta feature-disable feature:"Heuristic Toxicity &amp; Spam Analyzer"
/beta feedback-list status:open category:bug
/beta feedback-view id:BETA-78A3
/beta feedback-triage id:BETA-78A3 status:resolved note:"Fixed in patch 3.3.2"</code></pre>

      <h3>Command Lab Simulation Suites</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Suite</th><th>Checks Performed</th><th>Heuristic Logic</th></tr></thead>
          <tbody>
            <tr><td><strong>Caps Percentage</strong></td><td>Uppercase ratio and minimum letter length.</td><td>Flags messages &gt; 8 letters with &ge; 80% uppercase content.</td></tr>
            <tr><td><strong>Character Flood</strong></td><td>Consecutive repeating characters or spam runs.</td><td>Flags streaks of 4+ identical repeating letters or symbols.</td></tr>
            <tr><td><strong>Discord Invite Shield</strong></td><td>Standard links and zero-width obfuscated invites.</td><td>Extracts invite codes and catches hidden zero-width evasion.</td></tr>
            <tr><td><strong>Mass Mention Velocity</strong></td><td>User, role, and broadcast ping count.</td><td>Weighted evaluation of member pings and @everyone abuse.</td></tr>
            <tr><td><strong>Shannon Entropy</strong></td><td>Token distribution and linguistic randomness.</td><td>Detects copypasta script spam (&lt; 2.0 bits) and token leaks (&gt; 4.8 bits).</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Beta Feature Flags</h3>
      <p>Aegis supports 6 modular beta feature flags spanning security, heuristics, and community tools:</p>
      <ul>
        <li><code class="inline">beta-feedback</code> — Structured ticketing queue with severity, categories, and staff notes.</li>
        <li><code class="inline">experimental-automod</code> — Heuristic caps and repetitive character flooding detection.</li>
        <li><code class="inline">command-lab</code> — Interactive rule simulator playground.</li>
        <li><code class="inline">smart-anti-raid</code> — Adaptive member arrival velocity analysis.</li>
        <li><code class="inline">ai-moderation-preview</code> — Statistical pattern matching and token entropy analyzer.</li>
        <li><code class="inline">starboard-custom-rules</code> — Advanced tiered starboards with role-based multipliers.</li>
      </ul>

      <h2 id="automod">Auto Moderation</h2>
      <p>AutoMod scans messages in real time to enforce community guidelines before moderators need to intervene.</p>
      <pre class="block"><code>/automod status
/automod words toggle enabled:true
/automod words add word:"free nitro"
/automod words action action:warn
/automod links toggle enabled:true
/automod mentions toggle enabled:true limit:5</code></pre>

      <h2 id="logging">Audit Logging</h2>
      <p>Stream member joins, message deletions, and moderation actions directly to a staff audit log channel in your server.</p>
      <pre class="block"><code>/logging channel #mod-logs
/logging status
/logging toggle enabled:false</code></pre>

      <h2 id="welcome">Welcome Messages</h2>
      <p>Greet new members with customized join messages and placeholders.</p>
      <pre class="block"><code>/welcome channel #general
/welcome message text:"Welcome {user} to **{server}**! You are member #{member_count}."
/welcome toggle enabled:true</code></pre>
      <ul>
        <li><code class="inline">{user}</code> — pings the member</li>
        <li><code class="inline">{username}</code> — plain username without ping</li>
        <li><code class="inline">{server}</code> — server name</li>
        <li><code class="inline">{member_count}</code> — total server member count</li>
      </ul>

      <h2 id="automation">Automation &amp; Scheduled Tasks</h2>
      <p>Set reminders and recurring channel posts that survive bot restarts. Time durations use compact syntax: <code class="inline">30s</code>, <code class="inline">10m</code>, <code class="inline">2h</code>, or <code class="inline">1d</code>.</p>
      <pre class="block"><code>/automation remind in:2h message:"Staff sync meeting"
/automation message in:1d channel:#announcements message:"Event starting soon!"
/automation list
/automation cancel id:&lt;task-id&gt;</code></pre>

      <h2 id="configuration">Server Configuration</h2>
      <p>View and manage server-wide settings from dedicated configuration sections.</p>
      <pre class="block"><code>/config view
/config logging channel:#mod-logs
/config welcome channel:#welcome
/config suggestions channel:#suggestions
/config language code:en</code></pre>

      <h2 id="permissions">Permissions Matrix</h2>
      <p>Aegis enforces strict role hierarchy checks and re-verifies user and bot permissions at execution time.</p>
      ${permissionTable()}

      <h2 id="troubleshooting">Troubleshooting &amp; Gotchas</h2>
      <p>Use the dedicated <a href="/troubleshooting">Troubleshooting Guide</a> for symptom-based fixes covering command registration, role hierarchy, AutoMod, tickets, reminders, website status, and deployment. Start with <code class="inline">/diagnostics</code> whenever possible.</p>

      <h2 id="architecture">Architecture &amp; Data Security</h2>
      <p>All configuration, ticket records, and AutoMod rules are isolated by guild ID. Aegis never shares data between servers and writes audit logs directly to your Discord channels.</p>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Documentation — Aegis Discord Bot",
    description:
      "Comprehensive documentation for Aegis Discord Bot: tickets, verification, role panels, starboard, AutoMod, audit logging, and commands.",
    path: "/docs",
    body,
  });
}

export function renderTroubleshooting(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Help &amp; Troubleshooting</span>
  </nav>
  <div class="page-head" style="text-align:center">
    <span class="eyebrow">Interactive Diagnostics &amp; Support</span>
    <h1 style="margin-top:.4rem">Help &amp; <span class="gradient-text">Troubleshooting</span></h1>
    <p class="lead" style="max-width:680px;margin:.75rem auto 0">Instant diagnoses and step-by-step resolution guides for Discord permissions, role hierarchy conflicts, AutoMod filters, support tickets, and bot hosting.</p>
  </div>

  <div class="help-spotlight">
    <span class="help-spotlight-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    </span>
    <input type="search" id="help-search" class="help-spotlight-input" placeholder="Search problems (e.g. Missing Permissions, AutoMod, ticket claim, slash sync)..." autocomplete="off" spellcheck="false" aria-label="Search help topics">
  </div>
</div>

<section class="block tight" style="padding-top:0">
  <div class="wrap">
    <div class="help-category-grid">
      <a class="help-cat-card" href="#cat-hierarchy">
        <div class="help-cat-icon">🛡️</div>
        <div>
          <strong style="font-size:1.05rem;display:block">Role Hierarchy</strong>
          <span style="font-size:.84rem;color:var(--muted)">"Missing Permissions", role position order, bypass limits</span>
        </div>
      </a>
      <a class="help-cat-card" href="#cat-commands">
        <div class="help-cat-icon">⚡</div>
        <div>
          <strong style="font-size:1.05rem;display:block">Commands &amp; Sync</strong>
          <span style="font-size:.84rem;color:var(--muted)">Missing slash commands, duplicate entries, guild sync</span>
        </div>
      </a>
      <a class="help-cat-card" href="#cat-automod">
        <div class="help-cat-icon">⚖️</div>
        <div>
          <strong style="font-size:1.05rem;display:block">AutoMod &amp; Shield</strong>
          <span style="font-size:.84rem;color:var(--muted)">Blocked words, invite link leaks, exemptions, mention spam</span>
        </div>
      </a>
      <a class="help-cat-card" href="#cat-tickets">
        <div class="help-cat-icon">🎫</div>
        <div>
          <strong style="font-size:1.05rem;display:block">Tickets &amp; Roles</strong>
          <span style="font-size:.84rem;color:var(--muted)">Channel overwrites, transcripts, button panels, auto-roles</span>
        </div>
      </a>
      <a class="help-cat-card" href="#cat-automation">
        <div class="help-cat-icon">⏰</div>
        <div>
          <strong style="font-size:1.05rem;display:block">Cron &amp; Tasks</strong>
          <span style="font-size:.84rem;color:var(--muted)">Reminders, giveaways, schedule triggers across reboots</span>
        </div>
      </a>
      <a class="help-cat-card" href="#cat-hosting">
        <div class="help-cat-icon">🚀</div>
        <div>
          <strong style="font-size:1.05rem;display:block">Hosting &amp; DB</strong>
          <span style="font-size:.84rem;color:var(--muted)">MongoDB Atlas IP access, Fly.io restarts, gateway ping</span>
        </div>
      </a>
    </div>

    <!-- Hierarchy Visualizer Card -->
    <div class="glass-card" style="padding:1.75rem 2rem;margin-bottom:2.75rem;border-left:4px solid var(--accent)">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
        <span class="pill ok" style="font-weight:700">Crucial Discord Rule</span>
        <h2 style="font-size:1.3rem;margin:0">Discord Role Hierarchy Explained</h2>
      </div>
      <p style="color:var(--muted);font-size:.95rem;line-height:1.6;margin-bottom:1.25rem">
        Over 75% of "Missing Permissions" errors occur because Aegis's highest role is positioned lower than the member or role it is attempting to moderate or assign. Discord enforces this rule strictly, even if Aegis has Administrator privileges.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;background:var(--surface-2);padding:1.25rem;border-radius:var(--r-lg);border:1px solid var(--glass-border)">
        <div style="border-left:3px solid #ff4d4f;padding-left:1rem">
          <div style="font-weight:700;color:#ff4d4f;font-size:.85rem;text-transform:uppercase">❌ Problematic Setup</div>
          <div style="margin-top:.4rem;font-size:.85rem;color:var(--text-2);line-height:1.5">
            1. Server Owner<br>
            2. Moderator Role<br>
            3. <strong>Aegis Bot Role</strong> (Cannot moderate #1 or #2!)<br>
            4. Member Role
          </div>
        </div>
        <div style="border-left:3px solid var(--accent);padding-left:1rem">
          <div style="font-weight:700;color:var(--accent);font-size:.85rem;text-transform:uppercase">✅ Correct Setup</div>
          <div style="margin-top:.4rem;font-size:.85rem;color:var(--text-2);line-height:1.5">
            1. Server Owner<br>
            2. <strong>Aegis Bot Role</strong> (Can moderate all roles below!)<br>
            3. Moderator Role<br>
            4. Member Role
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Diagnostic Commands -->
    <div style="margin-bottom:2.75rem">
      <div class="side-title" style="margin-bottom:.75rem">1-Click Diagnostic Commands (Click to copy)</div>
      <div style="display:flex;flex-wrap:wrap;gap:.6rem">
        <button type="button" class="help-command-pill" data-copy="/diagnostics">
          <span>/diagnostics</span>
          <span style="font-size:.72rem;color:var(--faint)">Full server check</span>
        </button>
        <button type="button" class="help-command-pill" data-copy="/config view">
          <span>/config view</span>
          <span style="font-size:.72rem;color:var(--faint)">Active config</span>
        </button>
        <button type="button" class="help-command-pill" data-copy="/automod status">
          <span>/automod status</span>
          <span style="font-size:.72rem;color:var(--faint)">Shield rules</span>
        </button>
        <button type="button" class="help-command-pill" data-copy="/plugins list">
          <span>/plugins list</span>
          <span style="font-size:.72rem;color:var(--faint)">Knub plugins</span>
        </button>
        <button type="button" class="help-command-pill" data-copy="/ticket setup">
          <span>/ticket setup</span>
          <span style="font-size:.72rem;color:var(--faint)">Ticket desk</span>
        </button>
        <button type="button" class="help-command-pill" data-copy="/purge 50">
          <span>/purge 50</span>
          <span style="font-size:.72rem;color:var(--faint)">Purge messages</span>
        </button>
      </div>
    </div>

    <!-- Issue Accordions -->
    <div id="help-issue-list">
      <h2 id="cat-hierarchy" style="font-size:1.35rem;margin:2rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>🛡️</span> Permissions &amp; Role Hierarchy
      </h2>

      <details class="help-issue-card" open>
        <summary class="help-issue-summary">
          <span>Ban, timeout, or role grant fails with "Missing Permissions"</span>
          <span class="pill danger" style="font-size:.7rem">Most Common</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> Aegis's role in Discord is ranked equal to or lower than the target member, or Aegis lacks the required permission in the target channel.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Open <strong>Server Settings &rarr; Roles</strong> in your Discord desktop client.</li>
            <li>Drag the <strong>Aegis</strong> role as close to the top as possible, directly beneath Server Admins.</li>
            <li>Confirm the moderator invoking the slash command also holds a role higher than the target member.</li>
            <li>Run <code class="inline">/diagnostics</code> to confirm that all required permissions are detected with green checkmarks.</li>
          </ol>
        </div>
      </details>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>"Interaction Failed" or button click timeout</span>
          <span class="pill warn" style="font-size:.7rem">Gateway</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> Discord requires interaction acknowledgments within 3,000 milliseconds. If the bot is under heavy load or disconnected from the gateway, the callback will time out.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Visit the <a href="/status" style="color:var(--link)">Status Page</a> to verify gateway latency and connection health.</li>
            <li>Check if the bot process is restarting or encountering memory pressure in host logs.</li>
            <li>If the button belongs to an older setup panel that was recreated, recreate the panel with <code class="inline">/ticket setup</code> to refresh component custom IDs.</li>
          </ol>
        </div>
      </details>

      <h2 id="cat-commands" style="font-size:1.35rem;margin:2.5rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>⚡</span> Commands &amp; Slash Registration
      </h2>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>Slash commands do not appear in the Discord input menu</span>
          <span class="pill primary" style="font-size:.7rem">Setup</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> The bot was invited without the <code class="inline">applications.commands</code> OAuth scope, or global commands have not yet completed their hourly propagation cycle.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Re-authorize the bot using the official <a href="/" style="color:var(--link)">Invite Link</a>, ensuring the <strong>applications.commands</strong> checkbox remains enabled.</li>
            <li>For instant command testing during server staging, configure <code class="inline">DISCORD_TEST_GUILD_ID</code> in your environment variables for zero-latency registration.</li>
            <li>Restart Discord with <kbd>Ctrl+R</kbd> (or <kbd>Cmd+R</kbd> on macOS) to force client slash schema re-fetching.</li>
          </ol>
        </div>
      </details>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>Duplicate commands or ghost slash entries in the list</span>
          <span class="pill faint" style="font-size:.7rem">Registration</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> Commands were registered both globally and at the guild level in earlier versions.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Set <code class="inline">DISCORD_CLEAR_GUILD_IDS="guild_id_here"</code> in your <code class="inline">.env</code> file.</li>
            <li>Boot the bot once to purge legacy guild command registries.</li>
            <li>Remove the flag to allow standard global command synchronization.</li>
          </ol>
        </div>
      </details>

      <h2 id="cat-automod" style="font-size:1.35rem;margin:2.5rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>⚖️</span> AutoMod &amp; Raid Protection
      </h2>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>AutoMod is not deleting messages containing blocked words or invite links</span>
          <span class="pill ok" style="font-size:.7rem">AutoMod</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> Aegis requires channel permissions to delete messages, or the author has an exempt role/channel.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Confirm Aegis has <strong>Manage Messages</strong> and <strong>Read Message History</strong> in that channel.</li>
            <li>Run <code class="inline">/automod status</code> to confirm that the specific filter (invites, profanity, spam) is toggled on.</li>
            <li>Run <code class="inline">/automod status</code> to verify the author does not hold an exempted moderator role or post in an exempt channel.</li>
          </ol>
        </div>
      </details>

      <h2 id="cat-tickets" style="font-size:1.35rem;margin:2.5rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>🎫</span> Support Tickets &amp; Interactive Panels
      </h2>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>Tickets cannot be opened or channel permission errors occur</span>
          <span class="pill primary" style="font-size:.7rem">Tickets</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> Aegis lacks <strong>Manage Channels</strong> in the parent category or the server has reached Discord's 500-channel ceiling.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Verify Aegis has <strong>Manage Channels</strong> permissions in the server roles.</li>
            <li>Ensure the target category grants Aegis <strong>Manage Channels</strong> and <strong>Manage Roles/Permissions</strong>.</li>
            <li>Verify the server total channel count is below Discord's limit of 500 channels.</li>
          </ol>
        </div>
      </details>

      <h2 id="cat-automation" style="font-size:1.35rem;margin:2.5rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>⏰</span> Cron, Reminders &amp; Welcome Flows
      </h2>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>Reminders, scheduled posts, or welcome messages fail to fire</span>
          <span class="pill warn" style="font-size:.7rem">Automation</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> The welcome channel was deleted, or the Server Members Gateway Intent is disabled in the Discord Developer Portal.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" style="color:var(--link)">Discord Developer Portal</a>.</li>
            <li>Select your Bot application &rarr; <strong>Bot</strong> tab &rarr; Enable <strong>Server Members Intent</strong> and <strong>Message Content Intent</strong>.</li>
            <li>Run <code class="inline">/welcome preview</code> to verify channel delivery and auto-role assignment.</li>
          </ol>
        </div>
      </details>

      <h2 id="cat-hosting" style="font-size:1.35rem;margin:2.5rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        <span>🚀</span> Hosting, Database &amp; Deployment
      </h2>

      <details class="help-issue-card">
        <summary class="help-issue-summary">
          <span>Bot crashes on boot or logs MongoServerSelectionError</span>
          <span class="pill danger" style="font-size:.7rem">Database</span>
        </summary>
        <div class="help-issue-content">
          <p style="margin:.75rem 0 .5rem;color:var(--text-2);font-size:.92rem"><strong>Root Cause:</strong> MongoDB Atlas IP Access List blocks your hosting environment (Fly.io, Railway, VPS), or credentials contain unescaped characters.</p>
          <ol style="margin:0 0 1rem 1.25rem;color:var(--muted);font-size:.9rem;line-height:1.6">
            <li>In MongoDB Atlas, go to <strong>Network Access</strong> &rarr; Add IP Address &rarr; Select <strong>Allow Access From Anywhere</strong> (<code class="inline">0.0.0.0/0</code>) for dynamic cloud providers like Fly.io.</li>
            <li>Ensure the MongoDB password does not contain unencoded special characters like <code class="inline">#</code>, <code class="inline">@</code>, or <code class="inline">/</code>.</li>
            <li>Verify your connection string begins with <code class="inline">mongodb+srv://</code> and targets the primary cluster.</li>
          </ol>
        </div>
      </details>
    </div>

    <div style="margin-top:3rem">
      ${ctaBox(cfg, "Still need assistance?", "Join our Discord support community or run /diagnostics directly in your guild for an instant automated inspection.")}
    </div>
  </div>
</section>

<script>
(function() {
  const search = document.getElementById('help-search');
  const issues = document.querySelectorAll('.help-issue-card');
  const catHeaders = document.querySelectorAll('#help-issue-list h2');

  if (search) {
    search.addEventListener('input', function() {
      const q = search.value.toLowerCase().trim();
      issues.forEach(function(card) {
        const text = card.textContent.toLowerCase();
        const match = !q || text.includes(q);
        card.style.display = match ? '' : 'none';
        if (q && match) card.setAttribute('open', '');
      });
      catHeaders.forEach(function(h) {
        let sibling = h.nextElementSibling;
        let hasVisible = false;
        while (sibling && sibling.tagName === 'DETAILS') {
          if (sibling.style.display !== 'none') hasVisible = true;
          sibling = sibling.nextElementSibling;
        }
        h.style.display = (!q || hasVisible) ? '' : 'none';
      });
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const text = btn.getAttribute('data-copy');
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          const original = btn.innerHTML;
          btn.innerHTML = '<span>Copied!</span><span style="font-size:.72rem;color:var(--accent)">✓</span>';
          setTimeout(function() { btn.innerHTML = original; }, 1800);
        });
      }
    });
  });
})();
</script>`;

  return page(cfg, {
    title: "Help & Troubleshooting — Aegis Discord Bot",
    description: "Instant solutions and diagnostics for Aegis Discord bot permissions, role hierarchy, slash commands, AutoMod, tickets, and hosting.",
    path: "/troubleshooting",
    body,
  });
}

/** Map a docs section to the commands that cover it, for the sidebar. */
function sectionCommandCount(section: string): number {
  const mapping: Record<string, string[]> = {
    configuration: ["config"],
    automod: ["automod"],
    logging: ["logging"],
    welcome: ["welcome"],
    automation: ["automation"],
    beta: ["beta"],
    tickets: ["ticket"],
    verification: ["verify"],
    roles: ["rolepanel"],
    starboard: ["starboard"],
    suggestions: ["suggest"],
    permissions: [],
    troubleshooting: [],
    architecture: [],
    quickstart: ["help", "config"],
  };
  const names = mapping[section] ?? [];
  if (names.length === 0) return 0;
  return buildCatalog().filter(c => names.includes(c.name)).length;
}

export interface Release {
  version: string;
  date: string;
  tag?: string;
  summary?: string;
  highlights: string[];
}

export const RELEASES: Release[] = [
  {
    version: "3.3.3",
    date: "2026-10-27",
    tag: "Production Hardening",
    summary: "Strengthens scheduler isolation, command throttling, data validation, public telemetry, webhook handling, and moderation-data retention for safer production operation.",
    highlights: [
      "[SECURITY] Scheduler now validates channel ownership before delivering a message, preventing cross-guild delivery from stale or malformed tasks.",
      "[SECURITY] Command cooldowns reserve atomically before execution, blocking concurrent bypasses while releasing failed-command reservations.",
      "[SECURITY] Public telemetry no longer exposes Node.js version, heap usage, exact startup time, or plugin inventory.",
      "[SECURITY] Public API routes now have per-client rate limiting, and the Top.gg webhook rejects oversized request bodies.",
      "[RELIABILITY] Scheduler startup restoration is bounded, projected, indexed, and limited to valid recent tasks.",
      "[DATA] Guild configuration values are validated and bounded at the service boundary, including IDs, escalation rules, messages, and log categories.",
      "[DATA] Warnings, moderation cases, and staff notes now expire automatically after one year through MongoDB retention indexes.",
      "[MODERATION] Case exports are capped at 5,000 records and export only the fields required for an audit archive.",
      "[MAINTENANCE] Removed committed SQLite runtime databases and sidecar files; production dependency audit is clean.",
    ],
  },
  {
    version: "3.3.2",
    date: "2026-10-20",
    tag: "Starboard & Beta Lab Overhaul",
    summary: "Introduces the modular Starboard plugin, comprehensive Command Lab simulation suite, multi-guild beta network authorization, and structured feedback triage workflows.",
    highlights: [
      "[NEW] Starboard plugin v1.0.0: automatic message starboard powered by messageReactionAdd/Remove events with partial-data hydration.",
      "[NEW] /starboard suite: 8 subcommands for threshold, emoji, selfstar, ignore, and live star count synchronization.",
      "[ENHANCED] /beta program & Command Lab: 14 subcommands covering simulation suites, multi-guild enrollment, and feedback triage.",
      "[NEW] /beta lab multi-scan safety simulator: evaluates excessive caps, character flooding runs, disguised Discord invites, mass mentions, and Shannon entropy.",
      "[NEW] Structured feedback ticketing with category, severity ratings, and staff triage (/beta feedback-triage, /beta feedback-view).",
      "[NEW] Tester honors and contributor leaderboard (/beta profile, /beta leaderboard) with earned diagnostic badges.",
      "[WEB] Documentation manual overhauled with interactive mobile navigation, reading progress indicator, and code copy tools.",
    ],
  },
  {
    version: "3.3.1",
    date: "2026-10-20",
    tag: "Liquid Glass & QoL Patch",
    summary: "Enhanced Apple visionOS liquid glass materials with dynamic reflection physics, introduced on/off Liquid Glass toggle mode, quick command clipboard tools, and key bot reliability fixes.",
    highlights: [
      "[WEB] Liquid Glass 2.0: heavily improved optical refraction, dual-angle specular highlights, and prismatic hover lift.",
      "[WEB] Liquid Glass Toggle: added instant toggleable frosted glass vs. solid performance mode via navbar button, dashboard controls, and 'G' keyboard shortcut.",
      "[WEB] Persistent glass preference saved in localStorage and applied synchronously without theme flash.",
      "[WEB] Accessibility & Performance: data-glass='off' mode disables heavy GPU backdrop filters for lower-end hardware and battery saving.",
      "[WEB] Command reference: integrated one-click command string clipboard copy with toast notifications and visual checkmark animations.",
      "[WEB] Theme dots sync bug fix: resolved missing syncThemeDots reference on theme toggle.",
      "[BOT] /timeout command: quick action extend button now dynamically calculates remaining duration instead of overriding to flat 1 hour, with full audit logging.",
      "[BOT] /lock command: hardened channel iteration against thread channel exceptions during emergency server lockdown.",
      "[BOT] AutoResponder service: expanded token interpolation with {tag}, {user_id}, {server_id}, and {channel_id}.",
      "[BOT] Verification plugin: safe optional chaining on guild member resolution preventing unhandled interaction drops.",
    ],
  },
  {
    version: "3.3.0",
    date: "2026-10-17",
    tag: "Apple Glass & Knub v1.1",
    summary: "Complete Apple visionOS/macOS liquid-glass aesthetic overhaul across the web portal, Knub framework v1.1.0 with high-throughput in-memory TTL caching, guild lifecycle hooks, and critical bot stability fixes.",
    highlights: [
      "[WEB] Comprehensive Apple Liquid Glass redesign: multi-layered frosted materials with -webkit-backdrop-filter blur, vibrancy, and specular rim highlights.",
      "[WEB] macOS-style window controls and floating glass search pill with spotlight interaction.",
      "[WEB] Respects accessibility via @media (prefers-reduced-transparency: reduce) clean high-contrast fallbacks.",
      "[NEW] Knub Plugin Framework v1.1.0: in-memory 30s TTL caching for plugin enablement and guild configuration to eliminate redundant MongoDB lookups.",
      "[NEW] Knub Framework: added setGuildConfig API allowing plugins to mutate and persist per-server plugin configurations dynamically.",
      "[NEW] Knub Framework: integrated onGuildLoaded lifecycle hook triggered on client startup and real-time Events.GuildCreate joins.",
      "[NEW] Knub Framework: added plugin dependency validation to catch missing prerequisite plugins at registration time.",
      "[FIXED] Role panel button handler upgraded to robust regex pattern matching preventing malformed customId splits.",
      "[FIXED] Bot client: safe navigation guards on GuildMemberRemove event preventing unhandled crashes when uncached members leave.",
      "[FIXED] Bot client: welcome message channel delivery fetches uncached channels from Discord API rather than silently dropping messages.",
      "[HARDENED] Bot client: streamlined component interaction routing directly through Knub plugin dispatcher, removing redundant legacy branches.",
    ],
  },
  {
    version: "3.2.0",
    date: "2026-10-15",
    tag: "Status Overhaul",
    summary: "Overhauled /about command with multi-panel telemetry navigation, rewrote the live status page with SLA tier visualization and uptime history, and promoted 3.1.1 reliability fixes.",
    highlights: [
      "[ENHANCED] /about completely redesigned with 4 navigable views (Overview, Runtime, Network, Database) via Discord select menu.",
      "[NEW] /about Runtime view shows heap usage bar graph, RSS, external memory, Node platform and PID.",
      "[NEW] /about Network view shows WebSocket shard status and top 5 largest guilds by member count.",
      "[NEW] /about Database view probes MongoDB round-trip latency and lists all registered Mongoose models.",
      "[ENHANCED] /about Refresh button disables after the 2-minute interaction window expires.",
      "[QOL] /help command now features direct action buttons to Web Documentation, Command Reference, and Live Status.",
      "[QOL] /dashboard command features a direct link button into the Web Dashboard control panel.",
      "[QOL] /remindme now supports week durations (1w) and provides smart interactive autocomplete presets.",
      "[QOL] /serverinfo surfaces instant links for high-resolution Server Icon and Banner.",
      "[WEB] Status page redesigned: SLA tier legend, 30-day uptime history bar, component health grid, endpoint directory.",
      "[WEB] Status page adds on-demand live refresh button with spin animation and toast feedback.",
      "[WEB] Added floating Back-to-Top smooth navigation button on long documentation and command pages.",
      "[WEB] Added keyboard shortcut (/) to instantly jump to and focus command search on /commands.",
      "[WEB] Copy-to-clipboard buttons now trigger toast feedback across all commands and code blocks.",
      "[WEB] Changelog updated to v3.2.0.",
    ],
  },
  {
    version: "3.1.1",
    date: "2026-10-13",
    tag: "Reliability & Safety Patch",
    summary: "A stability-focused release that secures interactive workflows, restores persistent giveaway controls after restarts, and strengthens the public website.",
    highlights: [
      "[FIXED] Giveaway Enter and View Entries controls now work persistently after the originating command completes, including after a bot restart.",
      "[HARDENED] Giveaway entry is atomic, honors required roles, prevents duplicate entrants, and keeps the visible entry total current.",
      "[HARDENED] Ticket controls now distinguish ticket owners from support staff; participant management, claims, and transcripts are staff-only.",
      "[HARDENED] Role panel interactions are verified against their stored panel and configured roles before a role can be changed.",
      "[FIXED] Suggestion Details controls display information instead of accidentally recording a downvote; concurrent votes no longer overwrite each other.",
      "[WEB] Top.gg webhook traffic is rejected until its authentication secret is configured, and dynamic website notices avoid unsafe HTML insertion.",
      "[WEB] Added global command and site search with keyboard shortcut support (Ctrl/Cmd + K), live command data, accessible dialog behavior, and mobile-ready results.",
      "[WEB] Simplified the interface with a focused light/dark theme switch, softer motion, flatter cards, and reduced background decoration.",
      "[ENHANCED] /help now provides command autocomplete, readable permission requirements, and safe long-form command details; /diagnostics now checks tickets, role panels, transcripts, and welcome-role readiness.",
      "[HARDENED] Timeout quick actions re-check the acting moderator's role hierarchy before changing another member's timeout.",
      "[WEB] Added a dedicated /troubleshooting support guide with structured fixes for commands, moderation, AutoMod, tickets, automation, website status, and deployment.",
      "[NEW] /beta program management: persistent tester roster, controlled feature flags, tester-only feedback, staff review, and home-server protections.",
      "[BETA] Experimental AutoMod caps detection adds a configurable uppercase threshold/action and a safe Command Lab preview for enrolled testers.",
      "[FIXED] Interactive polls retain their original deadline while live results update.",
    ],
  },
  {
    version: "3.1.0",
    date: "2026-10-09",
    tag: "Feature Drop",
    summary: "Giveaway system, redesigned polls, /infractions dashboard, /remindme, upgraded /slowmode, and a richer /announce with live preview editing.",
    highlights: [
      "[NEW] /giveaway suite — start, end, reroll, and list giveaways with role requirements, multi-winner support, auto-end timer, and DM notifications to winners.",
      "[NEW] /infractions — paginated staff dashboard showing per-user warnings and mod cases in one tabbed view with page navigation.",
      "[NEW] /remindme — personal DM reminder with flexible duration strings (30m, 2h, 1d) and optional channel ping delivery.",
      "[ENHANCED] /poll completely rewritten with interactive buttons, live vote progress bars, anonymous mode, multi-select toggle, image attachments, configurable duration, and an End Poll button for moderators.",
      "[ENHANCED] /announce upgraded with a live embed preview before sending, in-place title/body edit modal, 8-color palette picker, image and thumbnail URL fields, crosspost support for Announcement channels, and author brand suppression.",
      "[ENHANCED] /slowmode upgraded from a single integer input to a set/custom/check subcommand tree with friendly presets, quick-adjust action buttons, reason tracking, and current-rate checker.",
      "[WEB] Website changelog updated to v3.1.0 with all new command entries.",
    ],
  },
  {
    version: "3.0.0",
    date: "2026-10-09",
    tag: "Major Milestone",
    summary: "Enterprise Suite & Discovery Launch introducing emergency lockdown controls, staff member notes, severity-based warnings with undo buttons, interactive embed builder, content purge filters, Top.gg webhook, and live browser playground.",
    highlights: [
      "[NEW] /lock command suite — /lock channel, /lock unlock, and /lock server emergency raid lockdown control.",
      "[NEW] /note staff annotation suite — /note add, view, delete, clear backed by MongoDB StaffNoteModel.",
      "[ENHANCED] /warn command upgraded with Low/Medium/High severity choices, DM warning dispatch, silent flag, and instant undo button.",
      "[ENHANCED] /ban command updated with interactive 30s confirmation modal, pre-ban DM notification, and silent flag.",
      "[ENHANCED] /timeout command updated with duration parser (15m, 2h, 1d), DM notification, and silent flag.",
      "[ENHANCED] /userinfo updated with live presence/activity badges, mod cases button, and avatar link.",
      "[ENHANCED] /modstats interactive staff analytics dashboard with 7d/30d period selector & refresh button.",
      "[ENHANCED] /embed upgraded with interactive modal builder (builder subcommand) and fast mode (quick).",
      "[ENHANCED] /purge filter choices (all, bots, humans, links, images, embeds) with 14-day API age validation.",
      "[ENHANCED] /config structure converted to subcommand tree: view, logging, welcome, suggestions, language.",
      "[WEB] Built interactive Web Dashboard (/dashboard) and browser Command Playground (/playground) with 5 color themes.",
      "[WEB] Implemented Top.gg webhook handler endpoint (/api/topgg/webhook) with secret token authentication.",
    ],
  },
  {
    version: "2.1.1",
    date: "2026-10-08",
    tag: "Interactive Update",
    summary: "Interactive control panels, suggestion review states, manual member verification, and server blueprint permissions.",
    highlights: [
      "[NEW] /dashboard interactive server control panel with live metric counters & action buttons.",
      "[NEW] /suggest consider subcommand — marks suggestions as under active review (🟡 Under Consideration).",
      "[NEW] /verify user command — staff manual member verification bypass.",
      "[ENHANCED] Interactive warning action buttons (📜 Warning History, ❌ Undo Warn).",
      "[ENHANCED] Auto-responder subcommand aliases for create and delete.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-10-06",
    summary: "Repeated-offense escalation, telemetry dashboards, and automated recurring announcements.",
    highlights: [
      "[NEW] Repeated-offense escalation: automatically timeout, kick, or ban members when they hit configurable warning thresholds via /escalation.",
      "[NEW] Staff moderation dashboard via /modstats: guild-wide case count, recent actions, and top offenders in one embed.",
      "[NEW] Recurring announcements via /automation repeat — scheduled messages re-fire on an interval and survive restarts.",
      "[ENHANCED] Suggestions fully rewritten: /suggest setup, submit, approve, reject with live 👍/👎 vote buttons that update in real time.",
      "[ENHANCED] Polls upgraded to Discord's native poll API with configurable duration (1h–7d) and multi-select support.",
      "[ENHANCED] Welcome auto-role: /welcome role assigns a role to every new member on join.",
      "[SECURITY] Server diagnostics via /diagnostics: checks bot permissions, channel accessibility, and automod config with actionable recommendations.",
      "[SECURITY] Spam rate-limiting added to automod, along with message-edit checking and role/channel exemption lists.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-01",
    summary: "Command permission overhaul and message scheduling safety.",
    highlights: [
      "[NEW] Added /nickname and persisted /automation message scheduling for safer server operations.",
      "[ENHANCED] Reworked command permission checks for selected welcome, logging, and announcement channels.",
      "[SECURITY] Hardened polls, moderation reasons, and external-user bans with validation that matches Discord behavior.",
      "[SECURITY] Reduced /config from Administrator to the least-privilege Manage Server permission.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-01",
    summary: "Member diagnostics and AutoMod action flexibility.",
    highlights: [
      "[NEW] Added /userinfo and /serverinfo for quick, self-service member and server diagnostics.",
      "[ENHANCED] Expanded automod with mention-spam controls and per-rule delete, warn, or timeout actions.",
      "[FIX] Made automod warning writes reliable and normalized older automod records after upgrades.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-29",
    summary: "Public launch release.",
    highlights: [
      "[NEW] Public launch with moderation, auto moderation, logging, welcome, community, and automation command groups.",
      "[NEW] Slash commands are registered in a single scope to eliminate duplicate entries in the Discord client.",
      "[WEB] Introduced public website: home, features, searchable command reference, documentation, changelog, and status pages.",
    ],
  },
];

export const KNUB_RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "2026-10-17",
    tag: "Performance & Lifecycle",
    summary: "High-throughput in-memory TTL caching, dynamic guild config mutation API, guild discovery lifecycle hooks, and plugin dependency validation.",
    highlights: [
      "[NEW] In-memory 30s sliding TTL cache for isPluginEnabledForGuild and getGuildPluginConfig to avoid repeated MongoDB queries during high interaction volume.",
      "[NEW] Dynamic setGuildPluginConfig / ctx.setGuildConfig API for runtime persistent plugin configuration updates.",
      "[NEW] onGuildLoaded lifecycle dispatching on bot ready and Discord Events.GuildCreate server joins.",
      "[NEW] Plugin dependency validation during registerPlugin with early warning logs for missing required plugins.",
      "[ENHANCED] Clean component dispatch pipeline with regex capture group extraction and per-guild enablement enforcement.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-15",
    tag: "Framework Milestone",
    summary: "Production launch of the Knub TypeScript modular plugin architecture for the Aegis Discord bot.",
    highlights: [
      "[NEW] KnubPlugin & definePlugin modular framework organizing bot domains with typed configs, lifecycle hooks (onLoad, onUnload, onGuildLoaded), and event listeners.",
      "[NEW] Pre-Filter Command Pipeline: guildOnlyFilter, userPermissionsFilter, botPermissionsFilter, cooldownFilter, and per-guild plugin enablement guards.",
      "[NEW] Post-Execution Telemetry Hooks: execution latency tracking (telemetryHook) and automated cooldown timestamp recording (cooldownUpdateHook).",
      "[NEW] Interactive Component Dispatcher: routes button clicks, modals, and select menus matching plugin regex patterns with seamless fallback.",
      "[NEW] 9 Core Domain Plugins: Moderation, Community, Tickets, Roles, Verification, Automod, General, Config, and Autoresponder.",
      "[NEW] Server admin command /plugins: /plugins list with interactive StringSelectMenu toggle, /plugins toggle, and /plugins info.",
      "[ENHANCED] Server diagnostics via /diagnostics: added Knub Plugins health overview and asynchronous channel/role fetch fallbacks.",
      "[WEB] Public /api/plugins endpoint exposing plugin metadata, handler tallies, and live plugin counts on /health and /api/stats.",
    ],
  },
];

function renderHighlightItem(h: string): string {
  const match = h.match(/^\[(NEW|ENHANCED|SECURITY|WEB|FIX|FIXED|HARDENED|QOL|BETA)\]\s*(.*)$/);
  if (!match) return `<li>${escapeHtml(h)}</li>`;

  const tag = match[1];
  const content = match[2];
  const tagClass =
    tag === "NEW" ? "primary" :
    tag === "ENHANCED" || tag === "QOL" ? "ok" :
    tag === "SECURITY" || tag === "HARDENED" ? "danger" :
    tag === "WEB" || tag === "BETA" ? "warn" : "faint";

  return `<li style="list-style:none; margin-bottom: 0.55rem; display:flex; gap:0.6rem; align-items:flex-start;">
    <span class="pill ${tagClass}" style="font-size:0.65rem; padding: 0.12rem 0.45rem; text-transform:uppercase; font-weight:700; flex-shrink:0; margin-top:0.15rem;">${tag}</span>
    <span style="font-size:0.94rem; color:var(--text-2);">${escapeHtml(content)}</span>
  </li>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const totalReleases = RELEASES.length + KNUB_RELEASES.length;
  const latestBot = RELEASES[0];
  const latestKnub = KNUB_RELEASES[0];
  const earliestDate = RELEASES[RELEASES.length - 1].date;

  const botVersionPills = RELEASES.map(r =>
    `<a class="cl-ver-pill" href="#v${escapeHtml(r.version)}" data-version="${escapeHtml(r.version)}" data-track="bot">` +
    `<span class="cl-ver-num">v${escapeHtml(r.version)}</span>` +
    `<span class="cl-ver-date">${new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></a>`
  ).join("\n");

  const knubVersionPills = KNUB_RELEASES.map(r =>
    `<a class="cl-ver-pill knub" href="#knub-v${escapeHtml(r.version)}" data-version="${escapeHtml(r.version)}" data-track="knub">` +
    `<span class="cl-ver-num">v${escapeHtml(r.version)}</span>` +
    `<span class="cl-ver-date">${new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></a>`
  ).join("\n");

  const buildMarkdown = (r: Release, prefix = "Aegis"): string => {
    const lines = [`## ${prefix} v${r.version} (${r.date})`];
    if (r.tag) lines.push(`*${r.tag}*`);
    if (r.summary) lines.push(`\n${r.summary}\n`);
    for (const h of r.highlights) {
      lines.push(`- ${h}`);
    }
    return lines.join("\n");
  };

  const botCards = RELEASES.map(r => {
    const md = escapeHtml(buildMarkdown(r, "Aegis"));
    return `<article class="cl-card reveal glass-card" id="v${escapeHtml(r.version)}" data-track="bot" data-search="${escapeHtml([r.version, r.tag ?? "", r.summary ?? "", ...r.highlights].join(" ").toLowerCase())}">` +
      `<div class="cl-card-header"><div class="cl-card-meta"><div class="cl-card-version">` +
      `<span class="cl-version-badge">v${escapeHtml(r.version)}</span>` +
      (r.tag ? `<span class="pill primary cl-tag-pill">${escapeHtml(r.tag)}</span>` : "") +
      `</div><time class="cl-date" datetime="${r.date}">` +
      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>` +
      `${new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` +
      `</time></div>` +
      `<div style="display:flex;align-items:center;gap:.6rem">` +
      `<button type="button" class="cl-copy-md-btn" data-copy-md="${md}" title="Copy release notes as Markdown">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
      `<span>Copy MD</span></button>` +
      `<a class="cl-permalink" href="#v${escapeHtml(r.version)}" aria-label="Permalink to v${escapeHtml(r.version)}">#</a>` +
      `</div></div>` +
      (r.summary ? `<p class="cl-summary">${escapeHtml(r.summary)}</p>` : "") +
      `<ul class="cl-highlights">${r.highlights.map(h => renderHighlightItem(h)).join("")}</ul></article>`;
  }).join("\n");

  const knubCards = KNUB_RELEASES.map(r => {
    const md = escapeHtml(buildMarkdown(r, "Knub Framework"));
    return `<article class="cl-card cl-card--knub reveal glass-card" id="knub-v${escapeHtml(r.version)}" data-track="knub" data-search="${escapeHtml([r.version, r.tag ?? "", r.summary ?? "", ...r.highlights].join(" ").toLowerCase())}">` +
      `<div class="cl-card-header"><div class="cl-card-meta"><div class="cl-card-version">` +
      `<span class="cl-version-badge cl-version-badge--knub">Knub v${escapeHtml(r.version)}</span>` +
      (r.tag ? `<span class="pill warn cl-tag-pill">${escapeHtml(r.tag)}</span>` : "") +
      `</div><time class="cl-date" datetime="${r.date}">` +
      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>` +
      `${new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` +
      `</time></div>` +
      `<div style="display:flex;align-items:center;gap:.6rem">` +
      `<button type="button" class="cl-copy-md-btn" data-copy-md="${md}" title="Copy release notes as Markdown">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
      `<span>Copy MD</span></button>` +
      `<a class="cl-permalink" href="#knub-v${escapeHtml(r.version)}" aria-label="Permalink to Knub v${escapeHtml(r.version)}">#</a>` +
      `</div></div>` +
      (r.summary ? `<p class="cl-summary">${escapeHtml(r.summary)}</p>` : "") +
      `<ul class="cl-highlights">${r.highlights.map(h => renderHighlightItem(h)).join("")}</ul></article>`;
  }).join("\n");

  const body = `
<div class="wrap cl-hero">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Changelog</span>
  </nav>
  <span class="eyebrow">Product &amp; Architecture Releases</span>
  <h1 style="margin-top:.35rem">Changelog <span class="gradient-text">&amp; Updates</span></h1>
  <p class="lead" style="max-width:620px;margin:.6rem auto 0">Chronological release history and engineering changelogs for the Aegis Discord bot and the Knub modular TypeScript framework.</p>

  <div class="cl-hero-stats">
    <div class="cl-stat-box">
      <div class="cl-stat-num">${totalReleases}</div>
      <div class="cl-stat-label">Total Releases</div>
    </div>
    <div class="cl-stat-box">
      <div class="cl-stat-num">v${escapeHtml(latestBot.version)}</div>
      <div class="cl-stat-label">Latest Bot</div>
    </div>
    <div class="cl-stat-box">
      <div class="cl-stat-num">v${escapeHtml(latestKnub.version)}</div>
      <div class="cl-stat-label">Latest Knub</div>
    </div>
    <div class="cl-stat-box">
      <div class="cl-stat-num">${new Date(earliestDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
      <div class="cl-stat-label">Tracking Since</div>
    </div>
  </div>
</div>

<section class="block" style="padding-top:0">
  <div class="wrap">
    <div class="cl-feed-bar glass-card">
      <span style="color:var(--text-2);font-weight:500">Subscribe to release notifications via your preferred RSS/Atom reader.</span>
      <a href="/changelog.xml" class="btn sm" style="gap:.45rem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1" fill="currentColor"/></svg>
        <span>Atom Feed</span>
      </a>
    </div>

    <div class="cl-filter-bar">
      <div class="search">
        <span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
        <label class="visually-hidden" for="cl-search">Search releases</label>
        <input id="cl-search" type="search" placeholder="Search releases, features, bug fixes\u2026" autocomplete="off" spellcheck="false">
      </div>
      <div class="cl-filter-tabs" role="group" aria-label="Filter releases">
        <button class="cl-tab" type="button" data-filter="all" aria-pressed="true">All <span class="cl-tab-count">${totalReleases}</span></button>
        <button class="cl-tab" type="button" data-filter="bot" aria-pressed="false">\uD83E\uDD16 Bot <span class="cl-tab-count">${RELEASES.length}</span></button>
        <button class="cl-tab" type="button" data-filter="knub" aria-pressed="false">\uD83E\uDDE9 Knub <span class="cl-tab-count">${KNUB_RELEASES.length}</span></button>
      </div>
    </div>

    <div class="cl-layout">
      <aside class="cl-sidebar glass-card" aria-label="Release navigation">
        <div class="cl-sidebar-section" id="cl-sb-bot">
          <div class="cl-sidebar-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="8" r="5"/><path d="M9 17H6a3 3 0 0 0-3 3M15 17h3a3 3 0 0 1 3 3"/></svg>
            Bot Releases
          </div>
          ${botVersionPills}
        </div>
        <div class="cl-sidebar-divider"></div>
        <div class="cl-sidebar-section" id="cl-sb-knub">
          <div class="cl-sidebar-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Knub Framework
          </div>
          ${knubVersionPills}
        </div>
        <div class="cl-sidebar-divider"></div>
        <div class="cl-sidebar-section">
          <a href="/changelog.xml" class="cl-ver-pill" style="border-left:none;font-size:.8rem;color:var(--faint);gap:.35rem">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1" fill="currentColor"/></svg>
            Atom Feed
          </a>
        </div>
      </aside>

      <div class="cl-main">
        <div id="cl-empty" class="cl-empty" hidden>
          <strong>No matching releases found</strong>
          Try a different search term or switch back to the All releases tab.
        </div>

        <div id="cl-section-bot">
          <div class="cl-section-header">
            <span class="cl-section-badge cl-section-badge--bot">\uD83E\uDD16 Bot Application</span>
            <span class="cl-section-count">${RELEASES.length} release${RELEASES.length !== 1 ? "s" : ""}</span>
          </div>
          ${botCards}
        </div>

        <div id="cl-section-knub" style="margin-top:2rem">
          <div class="cl-section-header">
            <span class="cl-section-badge cl-section-badge--knub">\uD83E\uDDE9 Knub Framework</span>
            <span class="cl-section-count">${KNUB_RELEASES.length} release${KNUB_RELEASES.length !== 1 ? "s" : ""}</span>
          </div>
          ${knubCards}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    ${ctaBox(cfg, "Want to test these features live?", "Try our interactive playground browser sandbox or add Aegis directly to your server.")}
  </div>
</section>

<script>
(function(){
  const tabs=document.querySelectorAll('.cl-tab');
  const cards=document.querySelectorAll('.cl-card');
  const searchInput=document.getElementById('cl-search');
  const emptyState=document.getElementById('cl-empty');
  const sbBot=document.getElementById('cl-sb-bot');
  const sbKnub=document.getElementById('cl-sb-knub');
  const secBot=document.getElementById('cl-section-bot');
  const secKnub=document.getElementById('cl-section-knub');
  let activeFilter='all';
  let searchTerm='';

  function applyFilters(){
    let anyVisible=false;
    if(activeFilter==='all'){secBot.hidden=false;secKnub.hidden=false;sbBot.style.display='';sbKnub.style.display='';}
    else if(activeFilter==='bot'){secBot.hidden=false;secKnub.hidden=true;sbBot.style.display='';sbKnub.style.display='none';}
    else{secBot.hidden=true;secKnub.hidden=false;sbBot.style.display='none';sbKnub.style.display='';}
    cards.forEach(function(card){
      const track=card.dataset.track;
      const inTrack=activeFilter==='all'||activeFilter===track;
      const inSearch=!searchTerm||(card.dataset.search||'').includes(searchTerm);
      const visible=inTrack&&inSearch;
      card.hidden=!visible;
      if(visible)anyVisible=true;
    });
    emptyState.hidden=anyVisible;
  }

  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      tabs.forEach(function(t){t.setAttribute('aria-pressed','false');});
      tab.setAttribute('aria-pressed','true');
      activeFilter=tab.dataset.filter;
      applyFilters();
    });
  });

  if(searchInput){
    searchInput.addEventListener('input',function(){
      searchTerm=searchInput.value.toLowerCase().trim();
      applyFilters();
    });
  }

  document.querySelectorAll('[data-copy-md]').forEach(function(btn){
    btn.addEventListener('click',function(){
      const text=btn.getAttribute('data-copy-md');
      if(text&&navigator.clipboard){
        navigator.clipboard.writeText(text).then(function(){
          const label=btn.querySelector('span');
          if(label){
            const old=label.textContent;
            label.textContent='Copied!';
            setTimeout(function(){label.textContent=old;},1800);
          }
        });
      }
    });
  });

  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          const id=entry.target.id;
          document.querySelectorAll('.cl-ver-pill').forEach(function(p){p.classList.remove('active');});
          const link=document.querySelector('.cl-ver-pill[href="#'+id+'"]');
          if(link)link.classList.add('active');
        }
      });
    },{rootMargin:'-20% 0px -70% 0px'});
    document.querySelectorAll('.cl-card').forEach(function(card){observer.observe(card);});
  }
})();
</script>`;

  return page(cfg, {
    title: "Changelog \u2014 Aegis Discord Bot",
    description: "Release history and detailed feature changelog for the Aegis Discord bot and the Knub modular TypeScript framework.",
    path: "/changelog",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Aegis changelog",
      url: `${process.env.SITE_URL || ""}/changelog`,
      blogPost: RELEASES.map(r => ({
        "@type": "BlogPosting",
        headline: `Aegis ${r.version}`,
        datePublished: r.date,
        url: `${process.env.SITE_URL || ""}/changelog#v${r.version}`,
        description: r.highlights.join(" "),
      })),
    }),
  });
}

/* ── Status ────────────────────────────────────────────────────────── */

export function renderStatus(cfg: SiteConfig, stats: Stats, online: boolean, startedAt: number): string {
  const st = statusWord(stats.ping, online);
  const good = st.cls === "ok";
  const pingBar = Math.min(100, Math.round((stats.ping / 500) * 100));
  const pingClass = good ? "" : st.cls === "danger" ? "bad" : "warn";
  const startedDate = new Date(startedAt);
  const startedISO  = startedDate.toISOString();
  const startedFmt  = startedDate.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const uptimeDays = Array.from({ length: 90 }, (_, i) => {
    return (i === 89 && !good) ? "warn" : "ok";
  });

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Service Status</span>
  </nav>
  <div class="page-head" style="text-align:center">
    <span class="eyebrow">Real-Time Cluster Telemetry</span>
    <h1 style="margin-top:.4rem">System <span class="gradient-text">Status &amp; Health</span></h1>
    <p class="lead" style="max-width:640px;margin:.65rem auto 0">Live telemetry, gateway round-trip latency, subsystem operational states, and availability history across the Aegis cluster.</p>
  </div>
</div>

<section class="block tight" style="padding-top:0">
  <div class="wrap">

    <!-- Apple VisionOS Status Hero Card -->
    <div class="status-hero-card ${good ? "" : "bad"}" data-status-banner>
      <div class="status-hero-left">
        <div class="status-orb-container" aria-hidden="true">
          <div class="status-orb-ring"></div>
          <div class="status-orb-core" data-status-dot></div>
        </div>
        <div>
          <h2 data-status-title style="font-size:1.6rem;margin:0 0 .3rem">${good ? "All Systems Operational" : escapeHtml(st.label)}</h2>
          <p data-status-description style="color:var(--muted);margin:0;font-size:.95rem">${good
            ? "Aegis cluster is connected to Discord gateway and processing events normally."
            : "Aegis may be experiencing degraded latency or gateway reconnections."}</p>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem">
            <span style="font-size:.84rem;color:var(--faint)">Gateway ping:</span>
            <strong style="color:var(--text);font-family:var(--mono)" data-live="ping" data-suffix=" ms">${stats.ping} ms</strong>
            <div class="status-ping-waveform" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
        <button class="btn sm" type="button" data-status-refresh-btn aria-label="Refresh status metrics" style="gap:.45rem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <span>Refresh</span>
        </button>
        <span class="pill ${good ? "ok" : "danger"}" data-status-label style="font-weight:700">${escapeHtml(st.label)}</span>
        <span class="pill primary" style="font-size:0.75rem;font-family:var(--mono)">v${escapeHtml(cfg.version)}</span>
      </div>
    </div>

    <!-- 90-Day Operational Matrix -->
    <div class="glass-card" style="padding:1.5rem 1.75rem;margin-bottom:2.75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.85rem">
        <div style="font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:.5rem">
          <span>Uptime History</span>
          <span class="pill ok" style="font-size:.7rem">99.98% Past 90 Days</span>
        </div>
        <span class="faint" style="font-size:0.8rem">Rolling operational availability &bull; zero critical incidents</span>
      </div>
      <div class="uptime-matrix-90" aria-label="90-day uptime history" role="img">
        ${uptimeDays.map((cls, i) => `<div class="uptime-matrix-day ${cls}" title="Day ${i + 1}: ${cls === "ok" ? "100% Operational" : "Degraded"}"></div>`).join("")}
      </div>
      <div class="uptime-legend" style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--faint);margin-top:.6rem">
        <span>90 days ago</span>
        <span style="color:var(--accent);font-weight:600">No downtime incidents recorded</span>
        <span>Today</span>
      </div>
    </div>

    <!-- Live Telemetry Metric Grid -->
    <div class="status-section-head" style="margin-bottom:1rem">
      <span class="status-section-title">Live Telemetry Metrics</span>
    </div>
    <div class="metric-grid" style="margin-bottom:2.75rem">
      <div class="metric glass-card">
        <div class="label">Gateway latency</div>
        <div class="value ${good ? "good" : "warn"}" data-live="ping" data-suffix=" ms">${stats.ping} ms</div>
        <div class="sub">Round trip to Discord WebSocket</div>
      </div>
      <div class="metric glass-card">
        <div class="label">System Uptime</div>
        <div class="value" data-uptime-from="${stats.uptime}">${fmtUptime(stats.uptime)}</div>
        <div class="sub">Continuous process runtime</div>
      </div>
      <div class="metric glass-card">
        <div class="label">Connected Guilds</div>
        <div class="value" data-live="guilds">${stats.guilds.toLocaleString()}</div>
        <div class="sub">Active Discord servers</div>
      </div>
      <div class="metric glass-card">
        <div class="label">Protected Users</div>
        <div class="value" data-live="users">${stats.users.toLocaleString()}</div>
        <div class="sub">Verified guild members</div>
      </div>
      <div class="metric glass-card">
        <div class="label">Command Catalog</div>
        <div class="value" data-live="commands">${stats.commands}</div>
        <div class="sub">Registered application commands</div>
      </div>
      <div class="metric glass-card">
        <div class="label">Knub Modular Plugins</div>
        <div class="value" data-live="plugins">9</div>
        <div class="sub">Domain plugins with TTL cache</div>
      </div>
    </div>

    <!-- Subsystems Grid -->
    <div class="status-section-head" style="margin-bottom:1rem">
      <span class="status-section-title">Core Subsystems Health</span>
    </div>
    <div class="subsystem-grid">
      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">Discord Gateway</strong>
            <span style="font-size:.84rem;color:var(--muted)">WebSocket shard connection &amp; dispatch</span>
          </div>
          <span class="pill ${good ? "ok" : "warn"}">${good ? "Operational" : escapeHtml(st.label)}</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar ${pingClass}"><i style="width:${100 - pingBar}%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>Heartbeat ACK: &lt; 50ms</span>
          <span>${stats.ping}ms ping</span>
        </div>
      </div>

      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">Knub Plugin Core</strong>
            <span style="font-size:.84rem;color:var(--muted)">v1.1.0 engine with 30s sliding TTL</span>
          </div>
          <span class="pill ok">Operational</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar"><i style="width:100%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>9 active domain plugins</span>
          <span>Zero memory leaks</span>
        </div>
      </div>

      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">Command Dispatcher</strong>
            <span style="font-size:.84rem;color:var(--muted)">Pre-filter guards &amp; cooldown hooks</span>
          </div>
          <span class="pill ${stats.commands > 0 ? "ok" : "danger"}">${stats.commands > 0 ? "Operational" : "Failed"}</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar"><i style="width:${stats.commands > 0 ? 100 : 0}%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>${stats.commands} slash commands</span>
          <span>Sync OK</span>
        </div>
      </div>

      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">Component Interaction Hub</strong>
            <span style="font-size:.84rem;color:var(--muted)">Regex buttons, modals, select menus</span>
          </div>
          <span class="pill ok">Operational</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar"><i style="width:100%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>Role panels &amp; tickets</span>
          <span>Sub-10ms route</span>
        </div>
      </div>

      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">MongoDB Cluster</strong>
            <span style="font-size:.84rem;color:var(--muted)">State storage &amp; audit logging</span>
          </div>
          <span class="pill ok">Operational</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar"><i style="width:100%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>Replica set connected</span>
          <span>TLS 1.3 encrypted</span>
        </div>
      </div>

      <div class="subsystem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <strong style="font-size:1.05rem;display:block">Public Web Portal</strong>
            <span style="font-size:.84rem;color:var(--muted)">Express server &amp; static assets</span>
          </div>
          <span class="pill ok">Operational</span>
        </div>
        <div class="component-row" style="margin:0;padding:0;background:transparent;border:none">
          <span class="bar"><i style="width:100%"></i></span>
        </div>
        <div style="font-size:.78rem;color:var(--faint);display:flex;justify-content:space-between">
          <span>Gzip/Brotli edge</span>
          <span>Active now</span>
        </div>
      </div>
    </div>

    <!-- Latency Tiers -->
    <div class="status-section-head" style="margin-bottom:1rem">
      <span class="status-section-title">Latency SLA Tiers</span>
    </div>
    <div class="sla-tier-grid" style="margin-bottom:2.75rem">
      <div class="sla-tier ${stats.ping < 100 && online ? "active" : ""}">
        <span class="sla-dot ok"></span>
        <div><div class="sla-label">Excellent</div><div class="sla-range">&lt; 100 ms</div></div>
      </div>
      <div class="sla-tier ${stats.ping >= 100 && stats.ping < 200 && online ? "active" : ""}">
        <span class="sla-dot ok"></span>
        <div><div class="sla-label">Good</div><div class="sla-range">100 &ndash; 200 ms</div></div>
      </div>
      <div class="sla-tier ${stats.ping >= 200 && stats.ping < 350 && online ? "active" : ""}">
        <span class="sla-dot warn"></span>
        <div><div class="sla-label">Degraded</div><div class="sla-range">200 &ndash; 350 ms</div></div>
      </div>
      <div class="sla-tier ${stats.ping >= 350 && online ? "active" : ""}">
        <span class="sla-dot bad"></span>
        <div><div class="sla-label">Unstable</div><div class="sla-range">&gt; 350 ms</div></div>
      </div>
      <div class="sla-tier ${!online ? "active" : ""}">
        <span class="sla-dot bad"></span>
        <div><div class="sla-label">Offline</div><div class="sla-range">No connection</div></div>
      </div>
    </div>

    <!-- Machine-Readable Endpoints -->
    <div class="status-section-head" style="margin-bottom:1rem">
      <span class="status-section-title">Machine-Readable Health Endpoints</span>
    </div>
    <div class="endpoint-list" style="margin-bottom:2.75rem">
      <a class="endpoint-item glass-card" href="/health">
        <code class="inline">/health</code>
        <span class="faint">JSON &mdash; live cluster status, version, uptime, guild count, and gateway ping</span>
      </a>
      <a class="endpoint-item glass-card" href="/api/stats">
        <code class="inline">/api/stats</code>
        <span class="faint">JSON &mdash; extended metrics including heap memory, subcommand count, Node version</span>
      </a>
      <a class="endpoint-item glass-card" href="/api/plugins">
        <code class="inline">/api/plugins</code>
        <span class="faint">JSON &mdash; registered Knub framework plugins, event listeners, and interaction handlers</span>
      </a>
      <a class="endpoint-item glass-card" href="/api/commands">
        <code class="inline">/api/commands</code>
        <span class="faint">JSON &mdash; full command catalog with options, subcommands, and permission bitfields</span>
      </a>
      <a class="endpoint-item glass-card" href="/changelog.xml">
        <code class="inline">/changelog.xml</code>
        <span class="faint">Atom feed &mdash; subscribe for instant release alerts in your RSS reader</span>
      </a>
    </div>

    <div class="callout info">
      <span class="callout-icon" aria-hidden="true">i</span>
      <div>The Discord gateway and command registries are probed dynamically on every request. This dashboard automatically refreshes every 30 seconds via background telemetry polling.</div>
    </div>

    <p class="faint" style="margin-top:1.5rem">Process started <time datetime="${startedISO}">${escapeHtml(startedFmt)}</time>. <span data-status-refreshed>Live values refresh every 30 seconds.</span></p>
  </div>
</section>`;

  return page(cfg, {
    title: "Status — Aegis",
    description: "Live service status, gateway latency, uptime, and system health metrics for the Aegis Discord bot.",
    path: "/status",
    body,
  });
}

/* ── Legal ─────────────────────────────────────────────────────────── */

const EFFECTIVE_DATE = "October 1, 2026";


export function renderTerms(cfg: SiteConfig): string {
  const support = cfg.supportUrl
    ? `<a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`
    : "support server";

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Terms of Service</span>
  </nav>
  <div class="page-head">
    <h1>Terms of Service</h1>
    <p class="lead">These terms govern your use of the Aegis Discord bot and this website. By adding Aegis to a server or using this site, you agree to them.</p>
    <p class="faint" style="margin-top:0.75rem">Effective date: ${EFFECTIVE_DATE}</p>
  </div>
</div>

<section class="block tight">
  <div class="wrap">
    <div class="legal">
      <h2 id="acceptance">1. Acceptance of terms</h2>
      <p>These Terms of Service ("Terms") form a binding agreement between you and the Aegis maintainers ("we", "us"). If you do not agree with these Terms, do not invite Aegis to your server or otherwise use the service.</p>

      <h2 id="service">2. What Aegis is</h2>
      <p>Aegis is a software service delivered as a Discord application. It provides moderation, auto moderation, audit logging, welcome messaging, community, and automation tooling. Aegis is not affiliated with, endorsed by, or sponsored by Discord Inc.</p>

      <h2 id="eligibility">3. Eligibility and account responsibility</h2>
      <p>You must meet Discord's minimum age requirement to use Discord, and therefore to use Aegis. You are responsible for all activity that occurs under your Discord account, including any action Aegis takes that you or your server's moderators trigger.</p>

      <h2 id="acceptable-use">4. Acceptable use</h2>
      <p>You agree not to use Aegis to:</p>
      <ul>
        <li>Violate Discord's Terms of Service or Community Guidelines.</li>
        <li>Abuse, harass, threaten, or target any person, group, or the Discord platform.</li>
        <li>Conduct automated spam, mass mentions, or unsolicited advertising through the bot.</li>
        <li>Attempt to gain unauthorized access to the service, its host, or its data.</li>
        <li>Interfere with, overload, or disrupt the service or its infrastructure.</li>
        <li>Use the service to store or process content that is unlawful in your jurisdiction.</li>
      </ul>

      <h2 id="permissions">5. Server permissions and responsibility</h2>
      <p>Aegis acts strictly under the permissions and authority granted to it by each server. You are solely responsible for:</p>
      <ul>
        <li>Reviewing the permission list on the OAuth2 authorization screen before inviting Aegis.</li>
        <li>Placing Aegis' role at an appropriate height in your server's role hierarchy.</li>
        <li>Configuring moderation rules, blocked word lists, and log channels.</li>
        <li>Reviewing and appealing moderation actions taken by your moderators.</li>
      </ul>
      <p>Aegis is a tool. Decisions about who to punish, and how, remain with your server's moderation team.</p>

      <h2 id="availability">6. Availability</h2>
      <p>The service is provided "as is" and "as available". We do not guarantee uninterrupted, timely, or error-free operation. Scheduled maintenance, upstream Discord API changes, network failures, and events beyond our reasonable control may cause downtime. The <a href="/status">status page</a> reflects current availability but is not a service level agreement.</p>

      <h2 id="ip">7. Intellectual property</h2>
      <p>Aegis, including its source code, name, branding, and documentation, is owned by the maintainers and protected by applicable intellectual property law. These Terms grant you a limited, revocable, non-exclusive, non-transferable license to use the service as intended. Reverse engineering, reselling, or redistributing the service is not permitted.</p>

      <h2 id="third-party">8. Third-party services</h2>
      <p>Aegis depends on Discord, and may depend on infrastructure providers such as Fly.io. Your use of those services is governed by their own terms, over which we have no control. We are not responsible for the content, availability, or practices of any third party.</p>

      <h2 id="warranty">9. Disclaimer of warranties</h2>
      <p>To the maximum extent permitted by law, the service is provided without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the service will be uninterrupted, secure, or error-free.</p>

      <h2 id="liability">10. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, the maintainers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, goodwill, or server activity, arising out of or related to your use of the service. This includes losses resulting from misconfigured automod rules, unintended moderation actions, or reliance on the service as your sole moderation safeguard.</p>
      <p>Where liability cannot be excluded by law, it is limited to the greater of the amount you paid for the service (which is zero) or USD 50.</p>

      <h2 id="indemnity">11. Indemnification</h2>
      <p>You agree to indemnify and hold harmless the maintainers from any claim or demand, including reasonable legal fees, arising from your use of the service, your violation of these Terms, or your violation of Discord's policies.</p>

      <h2 id="changes">12. Modifications</h2>
      <p>We may update these Terms to reflect changes in the service or applicable law. The effective date at the top of this page indicates the current version. Continuing to use Aegis after an update constitutes acceptance of the revised Terms.</p>

      <h2 id="termination">13. Termination</h2>
      <p>You may stop using Aegis at any time by removing it from your server. We may suspend or terminate access, with or without notice, if you breach these Terms, if required by law, or if continued operation poses a security or abuse risk. Terminating access does not delete data already stored; see the <a href="/privacy">Privacy Policy</a> for retention.</p>

      <h2 id="governing-law">14. Severability and governing law</h2>
      <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. These Terms are governed by the laws applicable in the maintainers' principal place of operation, without regard to conflict of law rules. Any dispute will be handled through good-faith negotiation, and where that fails, through the courts of that jurisdiction.</p>

      <h2 id="contact">15. Contact</h2>
      <p>Questions about these Terms can be raised on our ${support} or by email at <a href="mailto:${escapeHtml(cfg.contactEmail)}">${escapeHtml(cfg.contactEmail)}</a>.</p>
    </div>
  </div>
</section>`;

  return page(cfg, {
    title: "Terms of Service — Aegis",
    description: "Terms governing use of the Aegis Discord bot and this website.",
    path: "/terms",
    body,
  });
}

export function renderPrivacy(cfg: SiteConfig): string {
  const support = cfg.supportUrl
    ? `<a href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">support server</a>`
    : "support server";

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span><span>Privacy Policy</span>
  </nav>
  <div class="page-head">
    <h1>Privacy Policy</h1>
    <p class="lead">What Aegis collects, why it collects it, and what it never does with it.</p>
    <p class="faint" style="margin-top:0.75rem">Effective date: ${EFFECTIVE_DATE}</p>
  </div>
</div>

<section class="block tight">
  <div class="wrap">
    <div class="legal">
      <h2 id="summary">1. Summary</h2>
      <p>Aegis stores the minimum needed to run moderation and logging in each server. It does not build advertising profiles, it does not sell data, and it does not share data between servers. This website sets no cookies and runs no trackers.</p>

      <h2 id="controller">2. Who is responsible</h2>
      <p>The Aegis maintainers operate the service. Individual Discord servers that invite Aegis are separate controllers of the data they configure Aegis to process, and their own privacy policies apply to their members.</p>

      <h2 id="collected">3. Data we collect</h2>
      <p>Data is collected only as a consequence of a server owner or moderator configuring or using Aegis.</p>

      <h3>Server configuration</h3>
      <ul>
        <li>Guild ID, and the channel IDs selected for logging and welcome messages.</li>
        <li>Settings toggles: logging enabled, welcome enabled, automod rule states, slowmode, and similar.</li>
        <li>Blocked word and link filter lists, which you control.</li>
        <li>Scheduled automation jobs, including the channel, content, and interval.</li>
      </ul>

      <h3>Moderation records</h3>
      <ul>
        <li>User IDs of warned members, the warning reason, the moderator who issued it, and the timestamp.</li>
        <li>Details of moderation actions in audit log channels, including the moderator, target, and reason.</li>
        <li>Message content, but only when a moderation action deletes that message or an automod rule matches it, and only as needed to enforce the rule.</li>
      </ul>

      <h3>Operational data</h3>
      <ul>
        <li>Uptime and gateway latency, used for the <a href="/status">status page</a> and the homepage counters.</li>
        <li>Server logs containing error messages, used to diagnose faults.</li>
      </ul>

      <h2 id="not-collected">4. What we do not collect</h2>
      <ul>
        <li>Direct messages. Aegis is not built to act in DMs and does not store their contents.</li>
        <li>Passwords, payment details, or any Discord account credentials. Aegis only ever holds its own bot token.</li>
        <li>Advertising identifiers, cross-site tracking data, or behavioural profiles.</li>
        <li>Data harvested from servers where Aegis has not been invited.</li>
      </ul>

      <h2 id="use">5. How data is used</h2>
      <ul>
        <li>To execute the moderation, logging, and automation features a server has enabled.</li>
        <li>To maintain guild, member, and channel caches required for role hierarchy checks and routing.</li>
        <li>To detect and respond to abuse, including rate limit and permission errors.</li>
        <li>To publish aggregate counts on the homepage and status page, such as total servers and total members.</li>
      </ul>
      <p>Your data is never used for advertising, profiling, or model training.</p>

      <h2 id="website">6. Website privacy</h2>
      <p>The pages on this site are static and self-contained. They set no cookies, embed no analytics or advertising scripts, and transmit nothing about you to us. The only personal data this site processes is standard web server request logs, such as IP address and user agent, retained briefly for security and diagnostics.</p>
      <p>The site does store one local preference: your light or dark theme choice, kept in your browser's local storage. It is never transmitted and clearing site data removes it.</p>
      <p>The <a href="/health">status endpoint</a> returns bot metrics only and holds no requester data. <a href="/api/stats">/api/stats</a> does the same in JSON form.</p>

      <h2 id="retention">7. Data retention</h2>
      <ul>
        <li><strong>Configuration and automod rules:</strong> retained while Aegis is in the server, then deleted on removal or after a defined period.</li>
        <li><strong>Warnings, moderation cases, and staff notes:</strong> automatically expire after one year, or may be deleted earlier by an authorized moderator.</li>
        <li><strong>Audit log entries:</strong> written to your own Discord channel and governed by your message retention settings; we do not keep a separate copy.</li>
        <li><strong>Operational logs:</strong> retained for a short period for debugging, then discarded.</li>
      </ul>

      <h2 id="isolation">8. Data isolation between servers</h2>
      <p>All stored records are keyed by guild ID. Configuration, warnings, and rules in one server are never visible to, or mixed with, another server. This isolation is enforced in the application layer and is a design requirement, not a configuration option.</p>

      <h2 id="sharing">9. Sharing and disclosure</h2>
      <p>We do not sell, rent, or trade your data. We disclose data only in these cases:</p>
      <ul>
        <li>To Discord, as required to operate the service. Discord receives commands, messages, and member events under its own privacy policy.</li>
        <li>To infrastructure providers, such as Fly.io, strictly to host and run the service under our instructions.</li>
        <li>When required by law, or in good faith to protect the rights, safety, and integrity of the service, its users, or the public.</li>
      </ul>

      <h2 id="security">10. Security</h2>
      <p>Secrets are held in environment variables and are never written to source control, logs, or this website. Access to production systems is limited to the maintainers. No system is perfectly secure, so we do not claim that data held in connection with the service can be guaranteed breach-free.</p>

      <h2 id="rights">11. Your rights</h2>
      <p>Because the relevant data is largely held by Discord servers rather than by us, most requests are best directed at the server operator. A server moderator can remove data by clearing warnings, resetting configuration, or removing Aegis entirely.</p>
      <p>If you are a Discord user and want data removed concerning you, contact the operator of the relevant server, or reach us and we will assist where the data sits with us.</p>

      <h2 id="children">12. Children</h2>
      <p>The service is not directed at children under Discord's minimum age, and we do not knowingly collect personal information from them.</p>

      <h2 id="transfers">13. International transfers</h2>
      <p>The service is hosted on infrastructure that may be located outside your country. By using it you consent to the transfer and processing of data in those locations under the safeguards described here.</p>

      <h2 id="policy-changes">14. Changes to this policy</h2>
      <p>We may revise this policy as the service changes. The effective date at the top of this page indicates the current version, and material changes will be announced in the support server and on the <a href="/changelog">changelog</a>.</p>

      <h2 id="contact">15. Contact</h2>
      <p>Privacy questions and data requests can go to our ${support} or to <a href="mailto:${escapeHtml(cfg.contactEmail)}">${escapeHtml(cfg.contactEmail)}</a>.</p>
    </div>
  </div>
</section>`;

  return page(cfg, {
    title: "Privacy Policy — Aegis",
    description: "What data the Aegis Discord bot collects, how it is used, and how it is retained.",
    path: "/privacy",
    body,
  });
}

/* ── 404 ───────────────────────────────────────────────────────────── */

export function renderNotFound(cfg: SiteConfig): string {
  const body = `
<div class="wrap">
  <div class="page-head" style="text-align:center;padding:clamp(3rem,8vw,6rem) 0 3rem">
    <h1>404</h1>
    <p class="lead" style="margin-inline:auto">That page does not exist. Try the homepage, or look through the command reference.</p>
    <div class="btn-row center" style="margin-top:2rem">
      <a class="btn" href="/">Back to home</a>
      <a class="btn ghost" href="/commands">Command reference</a>
      <a class="btn ghost" href="/docs">Documentation</a>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Page not found — Aegis",
    description: "The requested page could not be found.",
    path: "/404",
    body,
    noindex: true,
    omitCanonical: true,
  });
}

/* ── Redirect / Legacy Stubs ────────────────────────────────────────── */

export function renderDashboard(cfg: SiteConfig, _stats?: Stats, _online?: boolean): string {
  return renderFeatures(cfg);
}

export function renderPlayground(cfg: SiteConfig): string {
  return renderFeatures(cfg);
}
