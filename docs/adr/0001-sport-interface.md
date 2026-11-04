# ADR 0001: The `Sport` interface

- **Status:** Accepted
- **Date:** Nov 4, 2026
- **Decisions:** D3, D7, D29, D40, Step 3 ("The rules that keep this clean")

## Context

LiterallyFantasySports starts with soccer but is planned for six sports
(D3, D62). The 2018 game kept its rules in one large controller, which made it
hard to change and impossible to reuse. This time the engine must:

- run the same match identically on the server (official result) and in the
  browser (previews, replays), so it can't touch a database or the network;
- let each sport define its own field, lineup shape and match loop without
  `packages/core` knowing about any sport;
- store only the inputs and a seed for each match, and rebuild everything else
  on demand (D7, Step 4 "Config versions and replays").

## Decision

`packages/core` defines a small, generic contract that each `packages/sport-*`
implements:

```ts
interface Sport<TTeam, TConfig, TEvent, TResult extends MatchResult> {
  id: SportId;
  name: string;
  grid: GridSize;          // influence grid, e.g. 17 × 25 for soccer
  playersOnField: number;  // drives the chemistry colour count (D51)
  allowsDraws: boolean;    // league matches only; knockouts always have a winner
  simulate(input: MatchInput<TTeam, TConfig>, seed: Seed): MatchOutput<TEvent, TResult>;
}
```

- **Generic team, config and event types.** Core doesn't say what a team or an
  event is. Soccer's team has 11 starters and a bench; baseball's will have a
  batting order and pitchers. Forcing one shape would bend every later sport
  around soccer.
- **One pure function per match.** `simulate` takes everything it needs
  (both teams, the match mode and the config version) plus a seed, and returns
  the result, the play-by-play and both influence maps. No clocks, no I/O, no
  `Math.random`.
- **Randomness only from `createRng(seed)`.** The generator (mulberry32) and
  string hashing are pinned by tests with exact expected values, because
  changing them would silently change every stored replay. `rng.fork(label)`
  gives sub-systems (injuries, cards, …) their own streams, so adding a new
  random roll later doesn't shift the existing ones.
- **Match mode instead of sport-specific tiebreaks in core.** Core only knows
  `"league"` (draws allowed if the sport allows them) and `"knockout"` (must
  return a winner). How a winner is found (extra time and penalties in soccer,
  extra innings in baseball) is the sport's business; it reports it in
  `result.decidedBy`.
- **Shared building blocks live in core only when they are truly
  sport-agnostic**: the RNG, Elo (D40) and influence-map arithmetic now;
  chemistry ranking next, since its rules (D42–D44, D51–D52) are defined for
  every sport. Everything else starts in `sport-soccer` and moves to core only
  when baseball proves it is shared.

## Consequences

- The web app and tools look sports up by `id` and call `simulate`; they never
  contain game rules.
- Each sport can be tested on its own with seeds, and a tuning harness can run
  thousands of matches quickly with no database.
- Any change to the RNG, or to how a sport consumes it, changes replays. Such
  changes must bump the config version, never alter old matches silently.
- The interface will likely grow when baseball arrives (for example lineup
  validation or per-sport stat lines). That is expected; this ADR will be
  superseded rather than the interface being designed for sports we haven't
  built yet.
