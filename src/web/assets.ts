export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="4" fill="#1b1b19"/>
  <path d="M16 6 24 9.2v6.3c0 4.9-3.3 8.3-8 9.5-4.7-1.2-8-4.6-8-9.5V9.2L16 6Z" fill="none" stroke="#5ec2a6" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

export const ogImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#fbfaf8"/>
  <rect x="0" y="0" width="1200" height="8" fill="#17695a"/>
  <g transform="translate(96 110)">
    <rect width="56" height="56" rx="6" fill="#1b1b19"/>
    <path d="M28 12 42 17.6v11c0 8.6-5.8 14.6-14 16.7-8.2-2.1-14-8.1-14-16.7v-11L28 12Z" fill="none" stroke="#5ec2a6" stroke-width="3" stroke-linejoin="round"/>
    <text x="80" y="40" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="34" font-weight="600" fill="#1b1b19">Aegis</text>
  </g>
  <text x="96" y="300" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="64" font-weight="600" fill="#1b1b19">A moderation bot for Discord.</text>
  <text x="96" y="366" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="30" fill="#5d5c57">Cases, automod, appeals, tickets, logging. Set up with slash commands.</text>
  <g transform="translate(96 450)">
    <rect width="620" height="64" rx="6" fill="#313338"/>
    <text x="24" y="41" font-family="IBM Plex Mono, Menlo, monospace" font-size="26" fill="#f2f3f5">/warn <tspan fill="#949ba4">user:</tspan>@spammer <tspan fill="#949ba4">reason:</tspan>invites</text>
  </g>
</svg>`;

export const manifest = JSON.stringify(
  {
    name: "Aegis — Discord Moderation Bot",
    short_name: "Aegis",
    description:
      "A Discord moderation bot: cases, automod, appeals, tickets and logging, set up with slash commands.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#fbfaf8",
    icons: [
      { src: "/assets/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  },
  null,
  2
);

export const themeInitScript = `(function(){var r=document.documentElement;r.classList.add("js");var t=null;try{t=localStorage.getItem("aegis-theme");}catch(e){}r.setAttribute("data-theme",t==="dark"?"dark":"light");})();`;

