import { redirect } from "next/navigation";

/** /baseball on its own goes to the club page (D191). */
export default function BaseballHome() {
  redirect("/baseball/team");
}
