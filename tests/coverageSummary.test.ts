import { test } from "node:test";
import assert from "node:assert/strict";
import { areaOf, parseLcov, summarize } from "../scripts/coverage-summary";

const lcov = `TN:
SF:src/web/pages/premium.ts
FNF:4
FNH:3
BRF:10
BRH:5
LF:100
LH:80
end_of_record
SF:src/services/premium.ts
FNF:0
FNH:0
LF:50
LH:50
end_of_record
`;

test("parseLcov reads per-file line, branch and function counts", () => {
  const files = parseLcov(lcov);
  assert.equal(files.length, 2);
  assert.deepEqual(files[0], {
    file: "src/web/pages/premium.ts",
    lines: [80, 100],
    branches: [5, 10],
    functions: [3, 4],
  });
  assert.deepEqual(files[1].branches, [0, 0]);
});

test("areaOf groups src files by their top folder", () => {
  assert.equal(areaOf("src/web/pages/premium.ts"), "src/web");
  assert.equal(areaOf("src/version.ts"), "src");
  assert.equal(areaOf("scripts/smoke-web.ts"), "scripts");
});

test("summarize renders a Markdown table with totals", () => {
  const md = summarize(parseLcov(lcov));
  assert.match(md, /^## Test coverage/);
  assert.match(md, /\| `src\/services` \| 1 \| 100\.0% \| n\/a \| n\/a \|/);
  assert.match(
    md,
    /\| \*\*Total\*\* \| \*\*2\*\* \| \*\*86\.7%\*\* \| \*\*50\.0%\*\* \| \*\*75\.0%\*\* \|/,
  );
});
