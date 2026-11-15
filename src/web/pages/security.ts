/**
 * Public /security page: how data is handled, the browser protections the
 * site sends, how secrets are kept, and how to report a vulnerability.
 * Every claim is checked against the code by tests/siteContentPages.test.ts
 * (CSP directives, header values, cookie flags, redacted secret names).
 */
import { REPO_URL, SUPPORT_SERVER_INVITE } from "../layout";
import { CONTENT_SECURITY_POLICY } from "../securityHeaders";
import { SECRET_ENV_KEYS } from "../../utils/logger";
import { DASHBOARD_VERSION } from "../../version";
import { type SiteConfig, breadcrumb, escapeHtml, page, safeUrl } from "./shared";

const SECTIONS: { id: string; title: string }[] = [
  { id: "report", title: "Reporting a vulnerability" },
  { id: "data", title: "How data is handled" },
  { id: "browser", title: "Browser protections and CSP" },
  { id: "secrets", title: "How secrets are kept" },
  { id: "scope", title: "Scope" },
  { id: "supported", title: "Supported versions" },
  { id: "response", title: "What happens next" },
];

export function renderSecurity(cfg: SiteConfig): string {
  const support = safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
  const toc = SECTIONS.map(s => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join("\n        ");
  const csp = CONTENT_SECURITY_POLICY.split("; ").map(d => `<li><code class="inline">${escapeHtml(d)}</code></li>`).join("\n          ");
  const secretNames = SECRET_ENV_KEYS.map(k => `<code class="inline">${escapeHtml(k)}</code>`).join(", ");
  const body = `
<div class="wrap">
  ${breadcrumb("Security")}
  <div class="page-head">
    <h1>Security</h1>
    <p class="lead">How Aegis handles data, what the website does to protect you, how secrets are kept, and how to report a vulnerability. The full policy is <a href="${REPO_URL}/blob/main/SECURITY.md" rel="noopener noreferrer">SECURITY.md</a> in the repository.</p>
  </div>
  <section class="at-a-glance" aria-labelledby="glance-title">
    <h2 id="glance-title">At a glance</h2>
    <ul>
      <li>Report vulnerabilities privately through GitHub's <strong>Report a vulnerability</strong> button, not in public.</li>
      <li>A strict content security policy: no inline scripts or styles, no framing, no third-party scripts.</li>
      <li>Dashboard session IDs are stored only as hashes; Discord access tokens never reach your browser.</li>
      <li>Secrets live in environment variables (Fly.io secrets in production), never in the code, and are redacted from logs.</li>
    </ul>
  </section>

  <details class="toc-mobile">
    <summary>Jump to a section</summary>
    <ul>
      ${toc}
    </ul>
  </details>

  <div class="split">
    <aside class="toc" aria-label="Sections">
      <p class="side-title">On this page</p>
      <ul>
        ${toc}
      </ul>
    </aside>
    <div class="legal">
      <h2 id="report">Reporting a vulnerability</h2>
      <p>Please report it privately, not in a public issue, Discord message or pull request.</p>
      <ol>
        <li>Open the repository's <a href="${REPO_URL}/security" rel="noopener noreferrer">Security tab</a> on GitHub.</li>
        <li>Choose <strong>Report a vulnerability</strong>. This opens a private advisory that only the maintainers can see.</li>
        <li>Describe the problem, the steps to reproduce it, the version (shown in the site footer and in <code class="inline">/about</code>) and what an attacker could do with it.</li>
      </ol>
      <p>If the Report a vulnerability button is not available, open a <a href="${REPO_URL}/issues" rel="noopener noreferrer">GitHub issue</a> that says only that you have a security report and would like a private way to send it, or ask for a private channel in the <a href="${support}" rel="noopener noreferrer">support server</a>. Do not include any details in public.</p>

      <h2 id="data">How data is handled</h2>
      <ul>
        <li><strong>Per server.</strong> Settings, warnings, cases, tickets and rules are stored by server ID in MongoDB and never shared between servers.</li>
        <li><strong>Expiry.</strong> Warnings, cases and staff notes are deleted after one year, dashboard activity after 180 days and dashboard sessions after 7 days. The <a href="/privacy">privacy policy</a> lists every record and its period.</li>
        <li><strong>Trust Score.</strong> Only message counts and last-active times are kept, never message content.</li>
        <li><strong>Dashboard sign-in.</strong> Discord login asks for the <code class="inline">identify</code> and <code class="inline">guilds</code> scopes only. The session cookie is signed, <code class="inline">HttpOnly</code>, <code class="inline">SameSite=Lax</code> and <code class="inline">Secure</code> over HTTPS; the database keeps only a SHA-256 hash of the session ID. The Discord access token stays on the server and is revoked when you log out.</li>
        <li><strong>Every request checked.</strong> The dashboard confirms Manage Server on each page and form, forms carry a CSRF token, and input that looks like a database operator is rejected.</li>
      </ul>

      <h2 id="browser">Browser protections and CSP</h2>
      <p>Every page, including the dashboard, is sent with this content security policy. All CSS and JavaScript load from <code class="inline">/assets</code>; no element carries an inline script, style or event handler.</p>
      <ul>
          ${csp}
      </ul>
      <p>Alongside it: HSTS for two years, <code class="inline">X-Frame-Options: DENY</code>, <code class="inline">X-Content-Type-Options: nosniff</code>, a strict referrer policy, a permissions policy that turns off the camera, microphone and location, and cross-origin isolation headers. The public API under <code class="inline">/api</code> is rate limited, and request bodies are capped.</p>

      <h2 id="secrets">How secrets are kept</h2>
      <p>The bot token, database connection string, dashboard secrets and webhook keys are read from environment variables. In production they are set as Fly.io secrets, which are encrypted at rest and never written to the repository, the Docker image or this website. Locally they come from a <code class="inline">.env</code> file that git ignores; <code class="inline">.env.example</code> lists the names with empty values.</p>
      <p>The logger redacts the values of ${secretNames} before anything is written, as well as passwords in connection strings and anything shaped like a Discord token. Shared secrets such as the Top.gg webhook key are compared in constant time.</p>

      <h2 id="scope">Scope</h2>
      <ul>
        <li>The Aegis bot and its slash commands.</li>
        <li>This website, its API under <code class="inline">/api</code>, and the dashboard under <code class="inline">/dashboard</code>.</li>
        <li>The source code in the <a href="${REPO_URL}" rel="noopener noreferrer">repository</a>.</li>
      </ul>
      <p>Discord itself, Fly.io and MongoDB are out of scope; report problems with them to those companies. Please do not run denial-of-service tests, spam servers, or access or change data that is not yours. Use your own test server.</p>

      <h2 id="supported">Supported versions</h2>
      <p>Only the latest release gets security fixes: bot ${escapeHtml(cfg.version)} and dashboard ${escapeHtml(DASHBOARD_VERSION)} at the moment. Older versions are not patched.</p>

      <h2 id="response">What happens next</h2>
      <p>The maintainer will acknowledge your report, look into it, and keep you updated in the advisory. Aegis is maintained in spare time, so there are no guaranteed response times. Fixes ship through the normal <a href="/changelog">changelog</a>, and you will be credited in the advisory if you would like to be.</p>
      <p>Machine-readable contact details are at <a href="/.well-known/security.txt">/.well-known/security.txt</a>.</p>
    </div>
  </div>
</div>`;

  return page(cfg, {
    title: "Security | Aegis",
    description: "How Aegis handles data, its content security policy, how secrets are kept, and how to report a security vulnerability in the bot, website or dashboard.",
    path: "/security",
    body,
  });
}
