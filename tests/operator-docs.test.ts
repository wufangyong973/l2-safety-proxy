import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PACK = [
  "docs/OPERATOR.md",
  "docs/PRE_INSTALL.md",
  "docs/CHANGE_PROTOCOL.md",
  "docs/TRIAGE.md",
  "docs/INCIDENTS.md",
  "docs/UPGRADE.md",
  "docs/ENVIRONMENTS.md",
  "docs/TOPOLOGY.md",
  "docs/LATENCY.md",
  "docs/ROLLBACK.md",
  "docs/templates/allowlist-inventory.md",
  "docs/templates/bypass-map.md",
  "docs/templates/raci-and-oncall.md",
  "docs/templates/risk-acceptance.md",
  "docs/templates/transport-inventory.md",
  "docs/templates/funding.md",
  "docs/templates/health-alerts.md",
  "docs/templates/escalation.md",
  "docs/templates/l2-send-guard.service",
];

const FORBIDDEN = [
  "CONTACT_EMAIL",
  "polar.sh",
  "wise.com",
  "USDT",
  "NPM_TOKEN",
  "fail closed out of the box",
  "Policy ON makes",
  "policy ON = safe",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function markdownLinks(text: string): string[] {
  const found: string[] = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) found.push(match[1]!);
  return found;
}

describe("operator pack", () => {
  it("ships every page and lists it in the npm files array", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { files: string[] };
    for (const rel of PACK) {
      expect(existsSync(join(root, rel)), rel).toBe(true);
      expect(pkg.files, rel).toContain(rel);
    }
  });

  it("keeps relative links inside the repo", () => {
    const pages = walk(join(root, "docs")).filter(
      (p) => p.endsWith(".md") && (p.includes(`${join("docs", "templates")}`) || PACK.some((rel) => p.endsWith(rel)))
    );
    const broken: string[] = [];
    for (const page of pages) {
      if (!PACK.some((rel) => page.endsWith(rel))) continue;
      const text = readFileSync(page, "utf8");
      for (const url of markdownLinks(text)) {
        if (/^[a-z]+:/i.test(url)) continue;
        const pathPart = url.split("#")[0];
        if (!pathPart) continue;
        const target = join(dirname(page), pathPart);
        if (!existsSync(target)) broken.push(`${page} -> ${url}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("does not invent a payee, a safe-agent claim, or a mainnet product", () => {
    for (const rel of PACK) {
      const text = readFileSync(join(root, rel), "utf8");
      for (const phrase of FORBIDDEN) {
        expect(text.includes(phrase), `${rel} contains ${phrase}`).toBe(false);
      }
    }
    const index = readFileSync(join(root, "docs/OPERATOR.md"), "utf8");
    expect(index).toContain("Policy ON is not a safe agent");
    expect(index).toContain("No mainnet SLA");
    expect(index).toContain("no payee");
    expect(readFileSync(join(root, "docs/ROLLBACK.md"), "utf8")).toContain("Stop the **agent**");
    expect(readFileSync(join(root, "docs/ENVIRONMENTS.md"), "utf8")).toContain("no mainnet");
    expect(readFileSync(join(root, "docs/LATENCY.md"), "utf8")).toContain("Do not treat its milliseconds");
    expect(readFileSync(join(root, "docs/TOPOLOGY.md"), "utf8")).toContain("127.0.0.1");
    expect(readFileSync(join(root, "docs/CHANGE_PROTOCOL.md"), "utf8")).toContain("policy:check");
    expect(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8")).toContain('"24"');
  });
});
