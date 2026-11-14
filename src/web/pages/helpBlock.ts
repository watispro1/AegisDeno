/**
 * "Need help?" pointers to the support server, used on /docs, /troubleshooting
 * and /status. Always uses the configured support URL (SUPPORT_SERVER_URL),
 * falling back to the default invite.
 */
import { SUPPORT_SERVER_INVITE } from "../layout";
import { type SiteConfig, safeUrl } from "./shared";

export function supportHref(cfg: SiteConfig): string {
  return safeUrl(cfg.supportUrl || SUPPORT_SERVER_INVITE);
}

/** A boxed block with the support server as the main action. */
export function needHelp(cfg: SiteConfig, text = "Ask in the support server. Run <code class=\"inline\">/diagnostics</code> first and paste its output, and a person can usually spot the problem straight away."): string {
  return `<aside class="help-block" aria-label="Need help?">
      <p class="help-block-title"><strong>Need help?</strong></p>
      <p>${text}</p>
      <div class="btn-row">
        <a class="btn" href="${supportHref(cfg)}" rel="noopener noreferrer">Join the support server</a>
        <a class="btn ghost" href="/troubleshooting">Troubleshooting</a>
      </div>
    </aside>`;
}

/** Small sidebar version for the docs table of contents. */
export function sideHelp(cfg: SiteConfig): string {
  return `<div class="doc-help">
        <p><strong>Need help?</strong> Real people answer in the support server.</p>
        <a class="text-link" href="${supportHref(cfg)}" rel="noopener noreferrer">Join the support server &rarr;</a>
      </div>`;
}
