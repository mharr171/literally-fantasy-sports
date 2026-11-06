/**
 * Soccer, as the game layer sees it (ADR 0007 §1). The only file in
 * `packages/game` that imports `@lfs/sport-soccer`; everything else imports
 * from here or asks the registry (`../sports.ts`), so a lint rule can keep
 * soccer from leaking into shared code.
 */
export * from "@lfs/sport-soccer";
