import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STALE_DAYS,
  classifyIssue,
  missingReproReasons,
  staleDecision,
} from "../scripts/repro-triage.mjs";

const EMPTY_TEMPLATE = `
**Pin**
- Package version or commit SHA (not \`@latest\`):
- Node version:
- OS:

\`\`\`text
npm test:
npm run demo:dual-layer:
\`\`\`
`;

const FILLED = `
- Package version or commit SHA (not \`@latest\`): 0.5.0
- Node version: v22.14.0
- OS: linux

\`\`\`text
npm test: 120 passed
npm run demo:dual-layer: Demo OK
-32080 definite-revert abort: PASS
\`\`\`
`;

describe("repro triage", () => {
  it("flags the checked-in bug template when the repro lines are still empty", () => {
    const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../.github/ISSUE_TEMPLATE/bug_report.md"), "utf8");
    const body = raw.replace(/^---[\s\S]*?---\n/, "");
    const decision = classifyIssue({ title: "[bug] example", body, labels: ["bug"] });
    expect(decision.action).toBe("comment");
    expect(decision.reasons).toContain("missing package pin or commit SHA");
    expect(decision.reasons).toContain("missing offline output (PASS, FAIL, Demo OK, an -3208x code, or Error:)");
  });

  it("flags an unfilled bug template", () => {
    const reasons = missingReproReasons(EMPTY_TEMPLATE);
    expect(reasons).toContain("missing offline output (PASS, FAIL, Demo OK, an -3208x code, or Error:)");
    expect(reasons).toContain("missing package pin or commit SHA");
    expect(reasons).toContain("missing Node version");
    expect(reasons).toContain("missing OS");
    expect(reasons).not.toContain("missing demo:dual-layer");
    expect(reasons).not.toContain("missing npm test");
  });

  it("accepts a filled template", () => {
    expect(missingReproReasons(FILLED)).toEqual([]);
  });

  it("accepts a prose repro that still names pin, runtime, and output", () => {
    const body = [
      "commit abcdef1 on Node v22.14.0, Ubuntu.",
      "npm test passed.",
      "npm run demo:dual-layer printed Demo OK and -32083.",
    ].join("\n");
    expect(missingReproReasons(body)).toEqual([]);
  });

  it("comments once on a bug and waits while the label is already set", () => {
    const opened = classifyIssue({ title: "[bug] halt", body: EMPTY_TEMPLATE, labels: ["bug"] });
    expect(opened.action).toBe("comment");
    expect(opened.comment).toMatch(/needs-repro/);
    expect(opened.comment).toMatch(/14 days/);

    const again = classifyIssue({
      title: "[bug] halt",
      body: EMPTY_TEMPLATE,
      labels: ["bug", "needs-repro"],
    });
    expect(again.action).toBe("wait");
    expect(again.comment).toBeUndefined();
  });

  it("clears the label once the repro is present", () => {
    const decision = classifyIssue({
      title: "x",
      body: FILLED,
      labels: ["bug", "needs-repro"],
    });
    expect(decision.action).toBe("clear");
  });

  it("does not touch feature requests, bots, or vulnerability reports", () => {
    expect(classifyIssue({ title: "[feat] chains", body: "", labels: ["enhancement"] }).action).toBe(
      "skip"
    );
    expect(classifyIssue({ title: "[bug] x", body: "", labels: ["bug"], user: "dependabot[bot]" }).action).toBe(
      "skip"
    );
    expect(
      classifyIssue({
        title: "[bug] vulnerability in proxy",
        body: "CVE-2026-0001",
        labels: ["bug"],
      }).action
    ).toBe("skip");
  });

  it("closes only stale needs-repro bugs, and clears a filled body instead", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.parse("2026-09-26T00:00:00.000Z");
    const old = new Date(now - (STALE_DAYS + 1) * day).toISOString();
    const fresh = new Date(now - (STALE_DAYS - 1) * day).toISOString();

    expect(
      staleDecision(
        { title: "[bug]", body: EMPTY_TEMPLATE, labels: ["bug", "needs-repro"], updatedAt: old },
        now
      ).close
    ).toBe(true);

    expect(
      staleDecision(
        { title: "[bug]", body: EMPTY_TEMPLATE, labels: ["bug", "needs-repro"], updatedAt: fresh },
        now
      ).action
    ).toBe("wait");

    expect(
      staleDecision(
        { title: "[bug]", body: FILLED, labels: ["needs-repro"], updatedAt: old },
        now
      ).action
    ).toBe("clear");

    expect(
      staleDecision(
        {
          title: "[bug] vulnerability",
          body: EMPTY_TEMPLATE,
          labels: ["needs-repro", "security"],
          updatedAt: old,
        },
        now
      ).close
    ).toBe(false);

    expect(
      staleDecision(
        { title: "[bug]", body: EMPTY_TEMPLATE, labels: ["needs-repro", "keep-open"], updatedAt: old },
        now
      ).action
    ).toBe("skip");
  });

  it("cli prints a JSON decision and does not exit on a feature request", () => {
    const dir = mkdtempSync(join(tmpdir(), "repro-"));
    const file = join(dir, "issue.json");
    writeFileSync(file, JSON.stringify({ title: "[feat] x", body: "", labels: ["enhancement"] }));
    const out = execFileSync(process.execPath, ["scripts/repro-triage.mjs", "classify", file], {
      encoding: "utf8",
      cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
    });
    expect(JSON.parse(out).action).toBe("skip");
  });
});
