/**
 * Version lockstep check. Fails (exit 1) unless every place that states the
 * bot or dashboard version agrees:
 *
 *   bot:       package.json "version", package-lock.json (root and packages[""]),
 *              VERSION in src/version.ts, a VERSION file if one exists,
 *              the README summary table, the newest release in CHANGELOG.md
 *   dashboard: DASHBOARD_VERSION in src/version.ts, the README summary table,
 *              the newest release in DASHBOARD_CHANGELOG.md
 *
 * Run with `npm run check:versions`. An "Unreleased" section at the top of a
 * changelog is skipped; the first numbered release is the one compared.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Found {
  source: string;
  value: string | null;
}

const SEMVER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;

/** First numbered "## [x.y.z]" heading, skipping [Unreleased]. */
export function newestChangelogVersion(markdown: string): string | null {
  const m = new RegExp(String.raw`^##\s*\[(${SEMVER})\]`, "m").exec(markdown);
  return m ? m[1] : null;
}

/** The README "Current version" table row: `| Current version | bot X, dashboard Y |`. */
export function readmeVersions(markdown: string): { bot: string | null; dashboard: string | null } {
  const row = /^\|\s*Current version\s*\|(.*)\|\s*$/im.exec(markdown)?.[1] ?? "";
  const bot = new RegExp(String.raw`\bbot\s+v?(${SEMVER})`, "i").exec(row)?.[1] ?? null;
  const dashboard = new RegExp(String.raw`\bdashboard\s+v?(${SEMVER})`, "i").exec(row)?.[1] ?? null;
  return { bot, dashboard };
}

/** `export const NAME = "x.y.z";` from src/version.ts. */
export function tsConst(source: string, name: string): string | null {
  const m = new RegExp(
    String.raw`export\s+const\s+${name}\s*(?::\s*string\s*)?=\s*["'](${SEMVER})["']`,
  ).exec(source);
  return m ? m[1] : null;
}

/** Groups that disagree, or any value that could not be read. Empty when all agree. */
export function mismatches(groups: Record<string, Found[]>): string[] {
  const problems: string[] = [];
  for (const [name, found] of Object.entries(groups)) {
    for (const f of found) {
      if (!f.value) problems.push(`${name}: could not read a version from ${f.source}`);
    }
    const values = new Set(found.map((f) => f.value).filter((v): v is string => Boolean(v)));
    if (values.size > 1) {
      problems.push(
        `${name} versions disagree:\n${found.map((f) => `  ${f.source}: ${f.value ?? "(missing)"}`).join("\n")}`,
      );
    }
  }
  return problems;
}

export function collect(root: string): Record<string, Found[]> {
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const pkg = JSON.parse(read("package.json")) as { version?: string };
  const versionTs = read("src/version.ts");
  const readme = readmeVersions(read("README.md"));

  const bot: Found[] = [
    { source: "package.json version", value: pkg.version ?? null },
    { source: "src/version.ts VERSION", value: tsConst(versionTs, "VERSION") },
    { source: "README.md Current version (bot)", value: readme.bot },
    { source: "CHANGELOG.md newest release", value: newestChangelogVersion(read("CHANGELOG.md")) },
  ];
  if (existsSync(join(root, "package-lock.json"))) {
    const lock = JSON.parse(read("package-lock.json")) as {
      version?: string;
      packages?: Record<string, { version?: string }>;
    };
    bot.push({ source: "package-lock.json version", value: lock.version ?? null });
    if (lock.packages?.[""])
      bot.push({
        source: 'package-lock.json packages[""].version',
        value: lock.packages[""].version ?? null,
      });
  }
  if (existsSync(join(root, "VERSION"))) {
    bot.push({ source: "VERSION file", value: read("VERSION").trim() || null });
  }

  const dashboard: Found[] = [
    { source: "src/version.ts DASHBOARD_VERSION", value: tsConst(versionTs, "DASHBOARD_VERSION") },
    { source: "README.md Current version (dashboard)", value: readme.dashboard },
    {
      source: "DASHBOARD_CHANGELOG.md newest release",
      value: newestChangelogVersion(read("DASHBOARD_CHANGELOG.md")),
    },
  ];
  return { bot, dashboard };
}

function main(): void {
  const groups = collect(join(__dirname, ".."));
  const problems = mismatches(groups);
  if (problems.length) {
    console.error(`Version lockstep check failed:\n\n${problems.join("\n\n")}`);
    process.exit(1);
  }
  console.log(
    `Versions agree: bot ${groups.bot[0].value}, dashboard ${groups.dashboard[0].value}.`,
  );
}

if (require.main === module) main();
