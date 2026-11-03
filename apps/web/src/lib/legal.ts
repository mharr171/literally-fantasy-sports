import { readFileSync } from "node:fs";
import path from "node:path";

/** Legal documents published from `docs/legal/` at the repo root (D74). */
export const legalDocs = {
  privacy: "privacy_policy.md",
  terms: "terms_of_service.md",
} as const;

export type LegalDoc = keyof typeof legalDocs;

/**
 * Reads a legal document's Markdown source. Called during prerender, so the
 * pages are static and pick up edits to `docs/legal/` on the next deploy.
 */
export function readLegalDoc(doc: LegalDoc): string {
  const file = path.join(
    process.cwd(),
    "..",
    "..",
    "docs",
    "legal",
    legalDocs[doc],
  );
  return readFileSync(file, "utf-8");
}
