import { Suspense } from "react";
import { SportGate } from "@/components/sport-gate";

/** Soccer's pages, shown only to viewers who may see soccer (D207). */
export default function SoccerLayout({ children }: LayoutProps<"/soccer">) {
  return (
    <Suspense fallback={null}>
      <SportGate sport="soccer">{children}</SportGate>
    </Suspense>
  );
}
