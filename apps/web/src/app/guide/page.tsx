import { DEFAULT_CHEMISTRY_BOOSTS, DEFAULT_ENERGY_SETTINGS } from "@lfs/core";
import {
  BOUGHT_TIERS,
  colorMatchups,
  DEFAULT_BALANCE,
  DEFAULT_POSITION_FIT_BONUSES,
  DEFAULT_ROSTER_LIMITS,
  defaultSoccerConfig,
  SOCCER_COLOR_CYCLE,
} from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";
import { liveSoccerConfig } from "@/lib/season";
import { loadEnergySettings, loadRosterLimits } from "@/lib/sport-settings";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ColorRing } from "@/sports/soccer/components/color-ring";
import { ChemistryDot } from "@/sports/soccer/components/player/player-card";

export const metadata: Metadata = {
  title: "Game guide",
  description:
    "How LiterallyFantasySports works: seasons, energy, squads, positions, packs, youth and chemistry colors.",
};

/** The game guide for new managers (D137), with the live settings' numbers. */
export default function GuidePage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Game guide</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Everything a new manager needs, from your first squad to which colors
          beat which. Numbers on this page are the game&apos;s current settings.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Guide />
      </Suspense>
    </section>
  );
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const money = (n: number) => n.toLocaleString("en-US");
const name = (c: number) => CHEMISTRY_COLORS[c]?.name ?? "?";

async function settings() {
  if (!getSupabaseEnv() || !process.env.SUPABASE_SECRET_KEY)
    return {
      config: defaultSoccerConfig(),
      balance: DEFAULT_BALANCE,
      energy: DEFAULT_ENERGY_SETTINGS,
      limits: DEFAULT_ROSTER_LIMITS,
    };
  const [{ config, balance }, energy, limits] = await Promise.all([
    liveSoccerConfig(),
    loadEnergySettings("soccer"),
    loadRosterLimits("soccer"),
  ]);
  return { config, balance, energy, limits };
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2 text-sm leading-6"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Guide() {
  const { config, balance, energy, limits } = await settings();
  const t = config.tuning;
  // The live color cycle (D149).
  const cycle = t.colorCycle ?? SOCCER_COLOR_CYCLE;
  const p = balance.payouts;
  const matchupsOn = Boolean(
    t.teamMatchup || t.teamMatchupSecond || t.playerMatchup,
  );
  const chem = DEFAULT_CHEMISTRY_BOOSTS;
  const fit = DEFAULT_POSITION_FIT_BONUSES;
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="On this page" className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["club", "Your club"],
            ["seasons", "Seasons"],
            ["energy", "Energy"],
            ["squad", "Squads and positions"],
            ["packs", "Packs"],
            ["youth", "Youth and ageing"],
            ["chemistry", "Chemistry"],
            ["matchups", "Color matchups"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="club" title="Your club">
        <p>
          You start by naming your club and opening 22 free starter packs. Keep
          between {limits.min} and {limits.max} players. Every player has an
          overall rating, a potential range (the real potential stays hidden), a
          main position, sometimes a second position, and a permanent chemistry
          color.
        </p>
      </Section>

      <Section id="seasons" title="Seasons">
        <p>
          Each season you play a league of 12 clubs: you and the 11 clubs
          nearest your Elo rating, copied as they are when the season starts and
          frozen for the whole season. Everyone plays everyone twice (22 weeks).
          Then 8th plays 9th in a play-in, and the top 7 plus the play-in winner
          play quarter-finals, semi-finals and a final.
        </p>
        <p>
          Every match pays {money(p.perMatch)}, plus {money(p.win)} for a win or{" "}
          {money(p.draw)} for a draw. Reaching the quarter-finals pays{" "}
          {money(p.quarter)}, the semi-finals {money(p.playoffs)}, the final{" "}
          {money(p.final)}, and winning it {money(p.champion)}. Your Elo goes up
          and down with results, which sets how strong your next league is.
        </p>
      </Section>

      <Section id="energy" title="Energy">
        {energy.enabled ? (
          <p>
            Playing a week costs 1 energy. You hold up to {energy.max}, and one
            comes back every {energy.refillMinutes} minutes. Weeks without your
            own match (when you&apos;re through to the next round, or out of the
            playoffs) are free, and you can have them skipped automatically.
          </p>
        ) : (
          <p>Energy is switched off for now: play as many weeks as you like.</p>
        )}
      </Section>

      <Section id="squad" title="Squads and positions">
        <p>
          Your matchday squad is 11 starters in a formation and up to{" "}
          {limits.benchMax} substitutes. You can plan up to {t.maxSubs}{" "}
          substitutions in up to {t.maxSubWindows} different minutes. The match
          also makes subs for tiredness, injuries and red cards. Injured and
          banned players are replaced from the bench by someone who plays the
          position. If nobody fit is left, your club starts a man down, and with
          fewer than 7 fit players the match is forfeited 3–0. With no fit
          keeper, an outfield player goes in goal.
        </p>
        <p>
          A player is worth {pct(fit.primary)} more in their main position and{" "}
          {pct(fit.secondary)} more in their second position.{" "}
          {t.outOfPosition !== 0 ? (
            <>
              Anywhere else they lose {pct(-t.outOfPosition)} of their skill, so
              auto-pick keeps everyone in their own positions when it can.
            </>
          ) : (
            <>
              Anywhere else they get no bonus. Auto-pick keeps everyone in their
              own positions when it can.
            </>
          )}{" "}
          Each player has their own heatmap for each of their positions: where
          on the pitch they have influence.
        </p>
        <p>
          Fitness, form and morale matter too: tired players are weaker, so
          rotate your squad over a season.
          {balance.condition.restBelowFitness > 0
            ? ` Auto-pick leaves players below ${balance.condition.restBelowFitness}% fitness out of the starting 11 whenever someone fitter can play, even out of position.`
            : ""}
        </p>
      </Section>

      <Section id="packs" title="Packs">
        <p>
          Buy packs of 5 players with your funds. Keep the ones you want and
          sell the rest back. A pack can cover every position or focus on
          attack, midfield, defence or goal ({pct(balance.packs.focusSurcharge)}{" "}
          dearer).
        </p>
        <p>
          You can also leave out 1, 2 or 3 chemistry colors so every player
          comes in the colors you keep. That costs{" "}
          {pct(balance.packs.excludeOne ?? 0.25)},{" "}
          {pct(balance.packs.excludeTwo ?? 0.6)} or{" "}
          {pct(balance.packs.excludeThree ?? 1.2)} more, on top of any position
          focus.
        </p>
        {(balance.packs.eloPerOverall ?? 0) > 0 && (
          <p>
            Packs keep up as your club climbs: every{" "}
            {balance.packs.eloPerOverall} Elo above 1500 moves the odds up one
            overall point (and below 1500, down), from −10 to +15, and the price
            moves {pct(balance.packs.pricePerOverall ?? 0.03)} per point. The
            shop shows the odds for your Elo now.
          </p>
        )}
        <ul className="list-disc pl-5">
          {BOUGHT_TIERS.map((tier) => (
            <li key={tier.id}>
              {tier.name}: {money(balance.packs.tiers[tier.id] ?? tier.price)}
              {(balance.packs.eloPerOverall ?? 0) > 0 ? " at Elo 1500" : ""}
              {tier.blurb ? `. ${tier.blurb}` : ""}
            </li>
          ))}
        </ul>
        <p>
          The playoffs pay in packs too: the champion gets a free Gold pack, the
          losing finalist a Silver pack and each losing semi-finalist a Basic
          pack. They wait on My team until you open them.
        </p>
      </Section>

      <Section id="youth" title="Youth and ageing">
        <p>
          At the end of each season, players age: young players grow towards
          their potential, players past their late twenties decline, and some
          older players retire. Then you get a youth intake of 22 prospects aged
          16 to 18 and can take any of them for free.
        </p>
      </Section>

      <Section id="chemistry" title="Chemistry">
        <p>
          Players of the same color play better together. On the pitch, your
          largest color group (at least {chem.minGroupSize} players) gets{" "}
          {pct(chem.largestAlone)} skill, or {pct(chem.largestTied)} each if two
          groups tie for largest. The second-largest group gets{" "}
          {pct(chem.secondAlone)} ({pct(chem.secondTied)} each if tied). It
          changes whenever a substitution changes who&apos;s on.
        </p>
      </Section>

      <Section id="matchups" title="Color matchups">
        <p>
          Colors also matter between teams. Each color beats the next two round
          the ring,{" "}
          {[...cycle, cycle[0] as number].map((c) => name(c)).join(" → ")}, and
          loses to the two before it. No color is better overall.
        </p>
        <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <ColorRing ring={cycle} />
          <table className="text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Color</th>
                <th className="py-1 pr-3">Beats</th>
                <th className="py-1">Loses to</th>
              </tr>
            </thead>
            <tbody>
              {cycle.map((color) => {
                const m = colorMatchups(color, cycle);
                const list = (cs: number[]) => (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {cs.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1">
                        <ChemistryDot color={c} /> {name(c)}
                      </span>
                    ))}
                  </span>
                );
                return (
                  <tr
                    key={color}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-1.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <ChemistryDot color={color} /> {name(color)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">{list(m.beats)}</td>
                    <td className="py-1.5">{list(m.losesTo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {matchupsOn ? (
          <p>
            If your dominant color beats your opponent&apos;s, your whole team
            plays {pct(t.teamMatchup)} better
            {t.teamMatchupSecond
              ? `, and ${pct(t.teamMatchupSecond)} more if your second color beats theirs`
              : ""}
            .{" "}
            {t.playerMatchup
              ? `Each player also gains or loses up to ${pct(t.playerMatchup)} depending on the colors of the opponents they face where they meet on the pitch.`
              : ""}
          </p>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Color matchups aren&apos;t switched on yet. When they are, a team
            whose dominant color beats its opponent&apos;s plays better, and
            each player gains or loses a little depending on who they face.
          </p>
        )}
        <p>
          Plan for it on the{" "}
          <Link href="/season/schedule" className="underline">
            season schedule
          </Link>
          , which shows every opponent&apos;s colors, and on the{" "}
          <Link href="/team/squad" className="underline">
            matchday squad
          </Link>{" "}
          page.
        </p>
      </Section>
    </div>
  );
}
