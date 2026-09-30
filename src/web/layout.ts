export interface NavLink {
  label: string;
  href: string;
  hideOnMobile?: boolean;
}

export interface LayoutOptions {
  title: string;
  description: string;
  path: string;
  body: string;
  links: NavLink[];
  inviteUrl: string;
  supportUrl: string;
  version: string;
}

export function layout(o: LayoutOptions): string {
  const nav = o.links
    .map(
      (l) =>
        `<a href="${l.href}"${l.hideOnMobile ? ' class="hide-sm"' : ""}>${l.label}</a>`,
    )
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<meta property="og:site_name" content="Aegis">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%235865F2'/%3E%3Ctext x='16' y='22' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='bold'%3EA%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<nav class="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="/"><span class="brand-mark">A</span>Aegis</a>
    <div class="nav-links">
      ${nav}
      <a class="btn" href="${o.inviteUrl}">Add to Discord</a>
    </div>
  </div>
</nav>
<main>
${o.body}
</main>
<footer>
  <div class="wrap footer-inner">
    <div>&copy; ${new Date().getFullYear()} Aegis. Not affiliated with Discord Inc.</div>
    <div class="footer-links">
      <a href="/commands">Commands</a>
      <a href="/docs">Docs</a>
      ${o.supportUrl ? `<a href="${o.supportUrl}">Support</a>` : ""}
      <a href="/health">Status</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}
