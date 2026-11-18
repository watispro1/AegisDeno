/**
 * Dashboard app chrome that is the same on every server page: the account
 * menu (with the theme row) and the shared overlays (toasts, unsaved-changes
 * bar, jump-to palette, shortcut help, confirm dialog), all driven by
 * dashboard.js. No inline script, style or handlers.
 */
import { escapeHtml as esc } from "../../pages";
import { THEME_OPTIONS, betaBadge } from "../../layout";
import type { Viewer } from "./layout";
import { isDiscordCdnUrl } from "../cdn";

function avatar(viewer: Viewer, shown: string): string {
  const url = viewer.avatarUrl;
  if (isDiscordCdnUrl(url)) {
    return `<img class="avatar has-img" src="${esc(url)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }
  const ch = Array.from(shown.trim())[0] ?? "?";
  return `<span class="avatar" aria-hidden="true">${esc(ch.toUpperCase())}</span>`;
}

/** The account menu in the top bar: who is signed in, links, theme row and Log out. */
export function userMenu(viewer: Viewer): string {
  const shown = viewer.globalName || viewer.username;
  const themes = THEME_OPTIONS.map(([id, label]) => `<button class="btn ghost xs" type="button" data-set-theme="${id}">${label}${betaBadge(id)}</button>`).join("\n          ");
  return `<details class="user-menu" data-menu>
      <summary aria-label="Account menu">${avatar(viewer, shown)}<span class="user-name">${esc(shown)}</span></summary>
      <div class="user-panel">
        <div class="user-panel-head">${avatar(viewer, shown)}<p>Signed in as <strong>${esc(shown)}</strong> <span class="faint">(${esc(viewer.username)})</span></p></div>
        <p class="user-panel-links"><a href="/dashboard">Your servers</a> · <a href="/dashboard/changelog">What's new</a></p>
        <div class="user-theme-picker" role="group" aria-label="Theme">
          <span class="faint">Theme</span>
          ${themes}
        </div>
        <form method="post" action="/dashboard/logout">
          <input type="hidden" name="_csrf" value="${esc(viewer.csrf)}">
          <button class="btn ghost sm" type="submit">Log out</button>
        </form>
      </div>
    </details>`;
}

/** Shared page furniture: toasts, the unsaved-changes bar and the dialogs. */
export const APP_CHROME = `<div class="nav-progress" data-nav-progress aria-hidden="true"></div>
  <div class="toast-region" data-toasts aria-live="polite" aria-atomic="false"></div>
  <div class="unsaved-bar" data-unsaved-bar hidden role="region" aria-label="Unsaved changes">
    <span class="unsaved-text"><span class="unsaved-dot" aria-hidden="true"></span>You have unsaved changes <span class="unsaved-count" data-unsaved-count></span></span>
    <span class="btn-row"><button class="btn ghost sm" type="button" data-unsaved-reset>Discard</button><button class="btn sm" type="button" data-unsaved-save>Save <kbd class="unsaved-kbd">Ctrl S</kbd></button></span>
  </div>
  <dialog class="palette" data-palette aria-label="Jump to a page">
    <label class="visually-hidden" for="palette-q">Jump to</label>
    <input type="search" id="palette-q" data-palette-input placeholder="Jump to a module or setting… (Enter to search cases)" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list">
    <ul id="palette-list" class="palette-list" role="listbox" data-palette-list></ul>
    <p class="faint palette-hint">↑ ↓ to move · Enter to open · Esc to close</p>
  </dialog>
  <dialog class="palette shortcuts" data-shortcuts aria-labelledby="shortcuts-h">
    <h2 id="shortcuts-h">Keyboard shortcuts</h2>
    <dl class="shortcut-list">
      <div><dt><kbd>Ctrl</kbd> <kbd>K</kbd> / <kbd>⌘</kbd> <kbd>K</kbd></dt><dd>Jump to a page or search cases</dd></div>
      <div><dt><kbd>/</kbd></dt><dd>Focus the table filter on this page</dd></div>
      <div><dt><kbd>Ctrl</kbd> <kbd>S</kbd> / <kbd>⌘</kbd> <kbd>S</kbd></dt><dd>Save the form you changed</dd></div>
      <div><dt><kbd>G</kbd> then <kbd>O</kbd> / <kbd>S</kbd> / <kbd>C</kbd> / <kbd>A</kbd> / <kbd>M</kbd></dt><dd>Go to Overview, Settings, Cases, Activity or Members</dd></div>
      <div><dt><kbd>[</kbd></dt><dd>Collapse or expand the sidebar</dd></div>
      <div><dt><kbd>?</kbd></dt><dd>Show this list</dd></div>
      <div><dt><kbd>Esc</kbd></dt><dd>Close dialogs and menus</dd></div>
    </dl>
    <form method="dialog"><button class="btn sm" type="submit">Close</button></form>
  </dialog>
  <dialog class="confirm-dialog" data-confirm-dialog aria-labelledby="confirm-title">
    <form method="dialog">
      <h2 id="confirm-title">Are you sure?</h2>
      <p data-confirm-text></p>
      <div class="btn-row"><button class="btn ghost" value="cancel" type="submit">Cancel</button><button class="btn danger" value="ok" type="submit" data-confirm-ok>Confirm</button></div>
    </form>
  </dialog>`;
