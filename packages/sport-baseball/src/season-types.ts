/** A club that could join a league (D115): another club's copy, at its Elo. */
export interface GhostCandidateLike {
  teamId: string;
  name: string;
  elo: number;
}
