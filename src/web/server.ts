import express from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";

export function startWebServer(client: Client) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get("/", (req, res) => {
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const ping = client.ws.ping;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aegis Bot Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --surface: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.1);
            --primary: #5865F2;
            --primary-glow: rgba(88, 101, 242, 0.5);
            --accent: #57F287;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow-x: hidden;
            position: relative;
        }

        /* Animated background glows */
        .glow {
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
            border-radius: 50%;
            top: -200px;
            left: -200px;
            filter: blur(80px);
            opacity: 0.5;
            z-index: 0;
            animation: float 10s ease-in-out infinite alternate;
        }

        .glow-2 {
            background: radial-gradient(circle, rgba(87, 242, 135, 0.3) 0%, transparent 70%);
            bottom: -200px;
            right: -200px;
            top: auto;
            left: auto;
            animation: float 12s ease-in-out infinite alternate-reverse;
        }

        @keyframes float {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
        }

        .container {
            position: relative;
            z-index: 1;
            text-align: center;
            max-width: 800px;
            padding: 2rem;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 4rem;
            font-weight: 800;
            letter-spacing: -0.05em;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
        }

        p.subtitle {
            font-size: 1.25rem;
            color: var(--text-muted);
            margin-bottom: 3rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            line-height: 1.6;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 2rem;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        border-color 0.3s ease,
                        box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            border-color: var(--primary);
            box-shadow: 0 10px 30px -10px var(--primary-glow);
        }

        .stat-value {
            font-family: 'Outfit', sans-serif;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 0.5rem;
        }

        .stat-label {
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            font-weight: 600;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: rgba(87, 242, 135, 0.1);
            border: 1px solid rgba(87, 242, 135, 0.2);
            border-radius: 99px;
            color: var(--accent);
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 2rem;
            box-shadow: 0 0 20px rgba(87, 242, 135, 0.1);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(87, 242, 135, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(87, 242, 135, 0); }
            100% { box-shadow: 0 0 0 0 rgba(87, 242, 135, 0); }
        }

        .cta-button {
            display: inline-block;
            background: var(--primary);
            color: white;
            text-decoration: none;
            padding: 1rem 2rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.2s;
            box-shadow: 0 4px 14px 0 rgba(88, 101, 242, 0.39);
        }

        .cta-button:hover {
            background: #4752C4;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(88, 101, 242, 0.5);
        }
    </style>
</head>
<body>
    <div class="glow"></div>
    <div class="glow glow-2"></div>
    
    <div class="container">
        <div class="status-badge">
            <div class="status-dot"></div>
            All Systems Operational
        </div>

        <h1>Aegis is Online.</h1>
        <p class="subtitle">The ultimate, high-performance moderation and community bot for Discord, proudly running on Fly.io.</p>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${guildCount}</div>
                <div class="stat-label">Servers</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${userCount}</div>
                <div class="stat-label">Users Protected</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(ping)}ms</div>
                <div class="stat-label">Gateway Ping</div>
            </div>
        </div>

        <a href="#" class="cta-button" onclick="alert('Add bot link here!')">Invite Aegis</a>
    </div>
</body>
</html>
    `;
    res.send(html);
  });

  app.listen(PORT, () => {
    logger.info(`🌐 Web Dashboard listening on port ${PORT}`);
  });
}
