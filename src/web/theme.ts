export const theme = {
  bg: "#09090b",
  surface: "rgba(255, 255, 255, 0.03)",
  border: "rgba(255, 255, 255, 0.1)",
  primary: "#5865F2",
  accent: "#57F287",
  text: "#f8fafc",
  muted: "#94a3b8",
};

export const head = (title: string, description: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>${styles}</style>
</head>`;

export const styles = `
:root {
  --bg: ${theme.bg};
  --surface: ${theme.surface};
  --border: ${theme.border};
  --primary: ${theme.primary};
  --accent: ${theme.accent};
  --text: ${theme.text};
  --muted: ${theme.muted};
  --max: 1120px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.wrap { position: relative; z-index: 1; max-width: var(--max); margin: 0 auto; padding: 0 1.5rem; }

h1, h2, h3 { font-family: 'Outfit', sans-serif; letter-spacing: -0.03em; line-height: 1.15; }

/* Nav */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  background: rgba(9, 9, 11, 0.72);
  border-bottom: 1px solid var(--border);
}
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.brand { display: flex; align-items: center; gap: 0.6rem; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.15rem; text-decoration: none; color: var(--text); }
.brand-mark {
  width: 30px; height: 30px; border-radius: 9px;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  display: grid; place-items: center;
  font-size: 0.95rem;
  box-shadow: 0 4px 14px -4px rgba(88,101,242,0.8);
}
.nav-links { display: flex; align-items: center; gap: 1.75rem; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 0.92rem; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
@media (max-width: 760px) { .nav-links .hide-sm { display: none; } }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--primary); color: #fff;
  padding: 0.7rem 1.35rem; border-radius: 10px;
  font-weight: 600; font-size: 0.94rem; text-decoration: none;
  border: 1px solid transparent;
  transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
  box-shadow: 0 4px 14px -4px rgba(88,101,242,0.7);
  cursor: pointer;
}
.btn:hover { background: #4752c4; transform: translateY(-2px); box-shadow: 0 8px 22px -6px rgba(88,101,242,0.85); }
.btn.ghost { background: transparent; border-color: var(--border); color: var(--text); box-shadow: none; }
.btn.ghost:hover { background: var(--surface); border-color: var(--primary); }
.btn.lg { padding: 0.9rem 1.75rem; font-size: 1.02rem; border-radius: 12px; }

/* Hero */
.hero { padding: 6.5rem 0 5rem; text-align: center; }
.badge {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.95rem; border-radius: 99px;
  background: rgba(87,242,135,0.08); border: 1px solid rgba(87,242,135,0.22);
  color: var(--accent); font-size: 0.82rem; font-weight: 600;
  margin-bottom: 1.75rem;
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 2s infinite; }
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(87,242,135,0.45); }
  70% { box-shadow: 0 0 0 9px rgba(87,242,135,0); }
  100% { box-shadow: 0 0 0 0 rgba(87,242,135,0); }
}
.hero h1 {
  font-size: clamp(2.6rem, 7vw, 4.6rem);
  font-weight: 800;
  margin-bottom: 1.4rem;
  background: linear-gradient(135deg, #fff 20%, #a5b4fc 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero p { font-size: 1.16rem; color: var(--muted); max-width: 640px; margin: 0 auto 2.5rem; }
.hero-cta { display: flex; gap: 0.9rem; justify-content: center; flex-wrap: wrap; }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-top: 4.5rem; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 1.5rem 1.25rem; }
.stat-value { font-family: 'Outfit', sans-serif; font-size: 2.1rem; font-weight: 700; }
.stat-label { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); font-weight: 600; }

/* Sections */
section.block { padding: 5rem 0; }
.section-head { text-align: center; margin-bottom: 3.25rem; }
.section-head .eyebrow { color: var(--primary); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.section-head h2 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 700; margin: 0.6rem 0 0.9rem; }
.section-head p { color: var(--muted); max-width: 600px; margin: 0 auto; }

/* Features */
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 1.25rem; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 18px; padding: 1.75rem;
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s, box-shadow 0.25s;
}
.card:hover { transform: translateY(-4px); border-color: rgba(88,101,242,0.55); box-shadow: 0 14px 34px -18px rgba(88,101,242,0.8); }
.card-icon {
  width: 40px; height: 40px; border-radius: 11px;
  background: rgba(88,101,242,0.14); border: 1px solid rgba(88,101,242,0.3);
  display: grid; place-items: center; font-size: 1.1rem;
  margin-bottom: 1.1rem;
}
.card h3 { font-size: 1.12rem; font-weight: 600; margin-bottom: 0.5rem; }
.card p { color: var(--muted); font-size: 0.93rem; }

/* Commands */
.cmd-group { margin-bottom: 2.5rem; }
.cmd-group h3 { font-size: 1.05rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; }
.cmd-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.6rem; }
.cmd {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 0.85rem 1rem;
}
.cmd-name { font-family: 'JetBrains Mono', monospace; font-size: 0.86rem; color: #c7d2fe; font-weight: 600; }
.cmd-desc { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
.sub { display: block; font-family: 'JetBrains Mono', monospace; color: var(--muted); font-size: 0.78rem; }

/* Steps */
.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; counter-reset: step; }
.step { position: relative; padding-top: 2.75rem; }
.step::before {
  counter-increment: step; content: counter(step);
  position: absolute; top: 0; left: 0;
  width: 34px; height: 34px; border-radius: 10px;
  background: rgba(88,101,242,0.15); border: 1px solid rgba(88,101,242,0.35);
  color: #c7d2fe; font-family: 'Outfit', sans-serif; font-weight: 700;
  display: grid; place-items: center;
}
.step h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.4rem; }
.step p { color: var(--muted); font-size: 0.92rem; }
code.inline { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.4rem; }

/* FAQ */
.faq { max-width: 720px; margin: 0 auto; }
details { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.1rem 1.35rem; margin-bottom: 0.75rem; }
summary { cursor: pointer; font-weight: 600; font-size: 0.98rem; list-style: none; display: flex; justify-content: space-between; align-items: center; }
summary::-webkit-details-marker { display: none; }
summary::after { content: '+'; color: var(--primary); font-size: 1.25rem; font-weight: 400; }
details[open] summary::after { content: '\u2212'; }
details p { color: var(--muted); font-size: 0.92rem; margin-top: 0.75rem; }

/* CTA */
.cta-box {
  text-align: center;
  background: linear-gradient(135deg, rgba(88,101,242,0.14), rgba(139,92,246,0.08));
  border: 1px solid rgba(88,101,242,0.32);
  border-radius: 26px; padding: 4rem 2rem;
}
.cta-box h2 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 700; margin-bottom: 0.9rem; }
.cta-box p { color: var(--muted); max-width: 520px; margin: 0 auto 2rem; }
.cta-actions { display: flex; gap: 0.9rem; justify-content: center; flex-wrap: wrap; }

/* Footer */
footer { border-top: 1px solid var(--border); margin-top: 5rem; padding: 3rem 0; }
.footer-inner { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center; color: var(--muted); font-size: 0.88rem; }
.footer-links { display: flex; gap: 1.5rem; }
.footer-links a { color: var(--muted); text-decoration: none; }
.footer-links a:hover { color: var(--text); }

.page-head { padding: 4rem 0 2.5rem; }
.page-head h1 { font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 800; margin-bottom: 0.8rem; }
.page-head p { color: var(--muted); max-width: 640px; }

@media (max-width: 620px) {
  .hero { padding: 4rem 0 3rem; }
  section.block { padding: 3.5rem 0; }
}
`;
