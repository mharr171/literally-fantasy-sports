import { redirect } from "next/navigation";

/** /soccer on its own goes to the club page (D191). */
export default function SoccerHome() {
  redirect("/soccer/team");
}
