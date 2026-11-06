import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { canSeeSport } from "@/lib/visible-sports";

/**
 * Shows a sport's pages only to viewers who may see the sport (D207):
 * everyone when it's public, admins always. Others get "not found".
 */
export async function SportGate({
  sport,
  children,
}: {
  sport: string;
  children: ReactNode;
}) {
  if (!(await canSeeSport(sport))) notFound();
  return children;
}
