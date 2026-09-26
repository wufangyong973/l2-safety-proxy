/**
 * Decide whether a GitHub bug issue is missing the offline repro, and whether
 * a `needs-repro` issue should be closed. Used by .github/workflows/repro-triage.yml
 * and tests/repro-triage.test.ts. No network.
 *
 *   node scripts/repro-triage.mjs classify issue.json
 *   node scripts/repro-triage.mjs stale issue.json <nowMs>
 */
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const STALE_DAYS = 14;

export const COMMENT_NEEDS_REPRO = [
  "This bug report is missing an offline repro, so it is labeled `needs-repro`.",
  "",
  "Reply with all of the following:",
  "- package version or commit SHA (not `@latest`)",
  "- Node version and OS",
  "- `npm test` output and `npm run demo:dual-layer` output, or why the offline demo failed",
  "- redacted env booleans only (`GUARD_MODE`, `L2SG_POLICY_ENABLED`, loopback yes/no)",
  "",
  "Do not paste keys, RPC URLs, or the allowlist. Template: `.github/ISSUE_TEMPLATE/bug_report.md`. How-to questions belong in Discussions.",
  "",
  "If this label is still present and the issue is not updated for 14 days, it will be closed. Remove `needs-repro` after the repro is in the body, or add `keep-open` if the label is a false alarm.",
].join("\n");

export const COMMENT_REPRO_PRESENT = "Offline repro looks present. Removed `needs-repro`.";

export const COMMENT_CLOSE = [
  "Closing after 14 days with `needs-repro` still set and no update.",
  "Re-open with the offline repro from the bug template: package pin, Node, OS, `npm test`, and `npm run demo:dual-layer`.",
  "A public Sepolia log is not a substitute for that offline repro.",
].join(" ");

function labelsOf(labels) {
  return (labels || []).map((l) => String(l).toLowerCase());
}

export function isSecurityReport({ title = "", body = "", labels = [] }) {
  if (labelsOf(labels).includes("security")) return true;
  const text = `${title}\n${body}`;
  if (/\bGHSA-|\bCVE-\d|security advisory/i.test(text)) return true;
  // The bug template tells people not to file vulnerabilities here. That
  // sentence is not a report. Any other use of the word is.
  const stripped = (body || "").replace(/Vulnerability reports do not belong here[^\n]*/gi, "");
  return /vulnerabilit/i.test(`${title}\n${stripped}`);
}

export function isBugIssue({ title = "", labels = [] }) {
  const names = labelsOf(labels);
  if (names.includes("bug")) return true;
  return /^\s*\[bug\]/i.test(title);
}

function hasPin(text) {
  // [ \t] so an empty "SHA:" line does not steal the next bullet.
  if (/Package version or commit SHA[^:\n]*:[ \t]*\S/i.test(text)) return true;
  if (/l2-send-guard@\d+\.\d+\.\d+/i.test(text)) return true;
  if (/(?:^|\n)[^\n]*\b(?:commit|sha|pin)\b[^\n]{0,48}\b[0-9a-f]{7,40}\b/i.test(text)) return true;
  return false;
}

function hasNode(text) {
  if (/Node version:[ \t]*\S/i.test(text)) return true;
  if (/\bnode(?:\.js)?[ \t]+v?\d+\.\d+/i.test(text)) return true;
  if (/\bv\d+\.\d+\.\d+\b/.test(text)) return true;
  return false;
}

function hasOs(text) {
  if (/^\s*-\s*OS:[ \t]*\S/im.test(text)) return true;
  if (/\b(linux|ubuntu|debian|macos|darwin|windows|win32|alpine)\b/i.test(text)) return true;
  return false;
}

function hasOfflineOutput(text) {
  return /(?:Demo OK|\bPASS\b|\bFAIL\b|-3208[0-4]|policy:check OK|Error:)/.test(text);
}

/** Empty array means the body is enough to debug without a founder ping. */
export function missingReproReasons(body) {
  const text = body || "";
  const reasons = [];
  if (!/demo:dual-layer/i.test(text)) reasons.push("missing demo:dual-layer");
  if (!/npm test/i.test(text)) reasons.push("missing npm test");
  if (!hasOfflineOutput(text)) {
    reasons.push("missing offline output (PASS, FAIL, Demo OK, an -3208x code, or Error:)");
  }
  if (!hasPin(text)) reasons.push("missing package pin or commit SHA");
  if (!hasNode(text)) reasons.push("missing Node version");
  if (!hasOs(text)) reasons.push("missing OS");
  return reasons;
}

/**
 * @returns {{ action: "skip" | "none" | "comment" | "wait" | "clear", reasons: string[], comment?: string }}
 */
export function classifyIssue(issue) {
  if (isSecurityReport(issue)) return { action: "skip", reasons: ["security"] };
  if (/\[bot\]$/i.test(issue.user || "")) return { action: "skip", reasons: ["bot"] };
  if (!isBugIssue(issue)) return { action: "skip", reasons: ["not-a-bug"] };
  const reasons = missingReproReasons(issue.body || "");
  const labeled = labelsOf(issue.labels).includes("needs-repro");
  if (reasons.length === 0) {
    return labeled
      ? { action: "clear", reasons: [], comment: COMMENT_REPRO_PRESENT }
      : { action: "none", reasons: [] };
  }
  if (labeled) return { action: "wait", reasons };
  return { action: "comment", reasons, comment: COMMENT_NEEDS_REPRO };
}

/**
 * Weekly close pass. Also clears the label when the body was fixed but the
 * label was left on, so a filled repro is not closed.
 */
export function staleDecision(issue, nowMs) {
  if (isSecurityReport(issue)) return { action: "skip", close: false };
  const names = labelsOf(issue.labels);
  if (names.includes("keep-open")) return { action: "skip", close: false };
  if (!names.includes("needs-repro")) return { action: "skip", close: false };
  if (missingReproReasons(issue.body || "").length === 0) {
    return { action: "clear", close: false, comment: COMMENT_REPRO_PRESENT };
  }
  const updated = Date.parse(issue.updatedAt || "");
  if (!Number.isFinite(updated)) return { action: "wait", close: false };
  const ageMs = nowMs - updated;
  if (ageMs < STALE_DAYS * 24 * 60 * 60 * 1000) return { action: "wait", close: false };
  return { action: "close", close: true, comment: COMMENT_CLOSE };
}

function readIssue(path) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  return {
    title: json.title || "",
    body: json.body || "",
    labels: json.labels || [],
    user: json.user || "",
    updatedAt: json.updatedAt || json.updated_at || "",
  };
}

function main(argv) {
  const cmd = argv[2];
  const path = argv[3];
  if (!cmd || !path) {
    console.error("usage: repro-triage.mjs classify|stale <issue.json> [nowMs]");
    process.exit(2);
  }
  const issue = readIssue(path);
  if (cmd === "classify") {
    process.stdout.write(`${JSON.stringify(classifyIssue(issue))}\n`);
    return;
  }
  if (cmd === "stale") {
    const nowMs = Number(argv[4]);
    if (!Number.isFinite(nowMs)) {
      console.error("stale requires nowMs");
      process.exit(2);
    }
    process.stdout.write(`${JSON.stringify(staleDecision(issue, nowMs))}\n`);
    return;
  }
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main(process.argv);
}
