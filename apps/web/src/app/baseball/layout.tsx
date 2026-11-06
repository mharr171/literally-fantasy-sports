import { Suspense } from "react";
import { SportGate } from "@/components/sport-gate";

/** Baseball's pages, shown only to viewers who may see baseball (D207). */
export default function BaseballLayout({ children }: LayoutProps<"/baseball">) {
  return (
    <Suspense fallback={null}>
      <SportGate sport="baseball">{children}</SportGate>
    </Suspense>
  );
}
