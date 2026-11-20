/**
 * Turns coverage/lcov.info (written by `npm run test:coverage`) into a short
 * Markdown summary: overall line, branch and function coverage, then a row per
 * source area. In CI it is appended to the job summary ($GITHUB_STEP_SUMMARY);
 * locally it prints to stdout. Informational only: it never fails the build.
 *
 * Only files that some test loads appear in the report, so the totals are for
 * code the tests reach, not for every file in src/.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";

export interface Counts {
  lines: [hit: number, found: number];
  branches: [hit: number, found: number];
  functions: [hit: number, found: number];
}

export interface FileCoverage extends Counts {
  file: string;
}

const empty = (): Counts => ({ lines: [0, 0], branches: [0, 0], functions: [0, 0] });

/** Parses an lcov tracefile into per-file counts. */
export function parseLcov(text: string): FileCoverage[] {
  const out: FileCoverage[] = [];
  let cur: FileCoverage | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      cur = { file: line.slice(3), ...empty() };
    } else if (cur && line === "end_of_record") {
      out.push(cur);
      cur = null;
    } else if (cur) {
      const [key, value] = line.split(":", 2) as [string, string | undefined];
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      if (key === "LF") cur.lines[1] = n;
      else if (key === "LH") cur.lines[0] = n;
      else if (key === "BRF") cur.branches[1] = n;
      else if (key === "BRH") cur.branches[0] = n;
      else if (key === "FNF") cur.functions[1] = n;
      else if (key === "FNH") cur.functions[0] = n;
    }
  }
  return out;
}

function add(into: Counts, from: Counts): void {
  for (const k of ["lines", "branches", "functions"] as const) {
    into[k][0] += from[k][0];
    into[k][1] += from[k][1];
  }
}

/** "src/web/pages/x.ts" -> "src/web"; "scripts/x.ts" -> "scripts". */
export function areaOf(file: string): string {
  const parts = file.replace(/\\/g, "/").replace(/^\.\//, "").split("/");
  if (parts[0] === "src" && parts.length > 2) return `src/${parts[1]}`;
  return parts.length > 1 ? parts[0] : "(root)";
}

const pct = ([hit, found]: [number, number]): string =>
  found === 0 ? "n/a" : `${((hit / found) * 100).toFixed(1)}%`;

export function summarize(files: FileCoverage[]): string {
  const total = empty();
  const areas = new Map<string, Counts & { files: number }>();
  for (const f of files) {
    add(total, f);
    const area = areaOf(f.file);
    const a = areas.get(area) ?? { ...empty(), files: 0 };
    add(a, f);
    a.files += 1;
    areas.set(area, a);
  }
  const rows = [...areas.entries()].sort(([a], [b]) => a.localeCompare(b));
  return [
    "## Test coverage",
    "",
    `Informational, no gate. ${files.length} source files loaded by the unit tests.`,
    "",
    "| Area | Files | Lines | Branches | Functions |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows.map(
      ([area, c]) =>
        `| \`${area}\` | ${c.files} | ${pct(c.lines)} | ${pct(c.branches)} | ${pct(c.functions)} |`,
    ),
    `| **Total** | **${files.length}** | **${pct(total.lines)}** | **${pct(total.branches)}** | **${pct(total.functions)}** |`,
    "",
  ].join("\n");
}

function main(): void {
  const path = process.argv[2] ?? "coverage/lcov.info";
  if (!existsSync(path)) {
    console.log(`No coverage file at ${path}; run \`npm run test:coverage\` first.`);
    return;
  }
  const md = summarize(parseLcov(readFileSync(path, "utf8")));
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (target) appendFileSync(target, md + "\n");
  console.log(md);
}

if (require.main === module) main();
