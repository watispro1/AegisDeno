/**
 * The site's stroke icons as an in-page SVG sprite. A page that uses icons
 * includes `iconSprite()` once and references symbols with `icon(id)`, so no
 * inline styles or external requests are needed (strict CSP).
 */
import { FEATURE_ICONS, type IconId } from "./featuresData";

export type { IconId };

/** The sprite with every symbol (or just `ids`), hidden from assistive tech. */
export function iconSprite(ids?: IconId[]): string {
  const entries = (Object.entries(FEATURE_ICONS) as Array<[IconId, string]>)
    .filter(([id]) => !ids || ids.includes(id));
  const symbols = entries.map(([id, d]) => `<symbol id="fi-${id}" viewBox="0 0 24 24">${d}</symbol>`).join("");
  return `<svg class="visually-hidden" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
}

/** A decorative icon from the sprite. */
export function icon(id: IconId, cls = "f-icon"): string {
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#fi-${id}"/></svg>`;
}
