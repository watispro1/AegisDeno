export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5865F2"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <path d="M16 6.5 24.5 10v6.2c0 5.1-3.5 8.6-8.5 9.8-5-1.2-8.5-4.7-8.5-9.8V10L16 6.5Z" fill="#fff" fill-opacity="0.16"/>
  <path d="M16 6.5 24.5 10v6.2c0 5.1-3.5 8.6-8.5 9.8-5-1.2-8.5-4.7-8.5-9.8V10L16 6.5Z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
  <text x="16" y="21.4" font-family="Outfit, Inter, sans-serif" font-size="12" font-weight="800" text-anchor="middle" fill="#fff">A</text>
</svg>`;

export const ogImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#14142b"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5865F2"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.15" r="0.7">
      <stop offset="0%" stop-color="#5865F2" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#5865F2" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0v48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g transform="translate(96 92)">
    <rect width="64" height="64" rx="18" fill="url(#brand)"/>
    <text x="32" y="44" font-family="Outfit, Inter, sans-serif" font-size="34" font-weight="800" text-anchor="middle" fill="#fff">A</text>
    <text x="84" y="46" font-family="Outfit, Inter, sans-serif" font-size="34" font-weight="700" fill="#f6f7fb">Aegis</text>
  </g>

  <text x="96" y="288" font-family="Outfit, Inter, sans-serif" font-size="72" font-weight="800" fill="#f6f7fb">Moderation that keeps up</text>
  <text x="96" y="366" font-family="Outfit, Inter, sans-serif" font-size="72" font-weight="800" fill="#a5b4fc">with your community.</text>

  <text x="96" y="428" font-family="Inter, sans-serif" font-size="27" fill="#98a1b8">Moderation &#183; Auto moderation &#183; Audit logging &#183; Automation</text>

  <g transform="translate(96 486)">
    <rect width="248" height="56" rx="12" fill="#5865F2"/>
    <text x="124" y="36" font-family="Inter, sans-serif" font-size="21" font-weight="600" text-anchor="middle" fill="#ffffff">Add to Discord</text>
    <text x="278" y="36" font-family="JetBrains Mono, monospace" font-size="21" fill="#6b7488">/help</text>
  </g>

  <g transform="translate(1000 500)">
    <circle cx="0" cy="0" r="7" fill="#4ade80"/>
  </g>
</svg>`;

export const manifest = JSON.stringify(
  {
    name: "Aegis — Discord Moderation Bot",
    short_name: "Aegis",
    description:
      "A fast, modular Discord bot for moderation, auto moderation, logging, and community management.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
icons: [
      { src: "/assets/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  },
  null,
  2
);

export const themeInitScript = `(function(){var r=document.documentElement;r.classList.add("js");var t=null;try{t=localStorage.getItem("aegis-theme");}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}r.setAttribute("data-theme",t);})();`;

