import Link from "next/link";

/**
 * Shown after an admin turned off the club's formation and its squad moved
 * to the closest one that's on (D140), until the manager saves the squad.
 */
export function FormationMoved({
  from,
  to,
  link = true,
}: {
  from: string;
  to: string;
  link?: boolean;
}) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="font-medium">
        {from} has been turned off for every club, so your squad now plays {to}.
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        The same players start, each moved to where they fit best.{" "}
        {link ? (
          <>
            Check your{" "}
            <Link href="/team/squad" className="underline">
              matchday squad
            </Link>{" "}
            and save it.
          </>
        ) : (
          "Check it below and save it."
        )}
      </p>
    </div>
  );
}
