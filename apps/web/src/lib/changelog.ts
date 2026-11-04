/**
 * Turns CHANGELOG.md (written by release-please, D71) into what players see
 * on the What's new page (M6): new features and fixes per version, without
 * admin-only items, docs, CI, links or commit hashes.
 */

export interface Release {
  version: string;
  /** ISO date, e.g. "2026-11-04". */
  date: string;
  features: string[];
  fixes: string[];
}

const PLAYER_SECTIONS: Record<string, "features" | "fixes"> = {
  Features: "features",
  "Bug Fixes": "fixes",
  Performance: "fixes",
};

const HIDDEN_SCOPES = new Set(["admin", "db"]);

/** One changelog bullet as a plain sentence, or null if players needn't see it. */
export function playerLine(bullet: string): string | null {
  let text = bullet.replace(/^\*\s+/, "").trim();
  // A scope such as **admin:** marks what it's about; admin tools and
  // database plumbing stay hidden.
  const scope = text.match(/^\*\*([^*]+):\*\*\s*/);
  if (scope) {
    if (HIDDEN_SCOPES.has(scope[1]?.trim() ?? "")) return null;
    text = text.slice(scope[0].length);
  }
  // Drop the trailing "([#46](…)) ([49b2b3a](…))" links.
  text = text.replace(/(\s*\(\[[^\]]*\]\([^)]*\)\))+\s*$/, "").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  let section: "features" | "fixes" | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const heading = line.match(
      /^##\s+\[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))?\s*\((\d{4}-\d{2}-\d{2})\)/,
    );
    if (heading) {
      current = {
        version: heading[1] as string,
        date: heading[2] as string,
        features: [],
        fixes: [],
      };
      releases.push(current);
      section = null;
      continue;
    }
    const sub = line.match(/^###\s+(.+)$/);
    if (sub) {
      section = PLAYER_SECTIONS[sub[1]?.trim() ?? ""] ?? null;
      continue;
    }
    if (current && section && line.startsWith("* ")) {
      const text = playerLine(line);
      if (text) current[section].push(text);
    }
  }
  return releases;
}
