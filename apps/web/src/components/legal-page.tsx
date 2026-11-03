import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type LegalDoc, readLegalDoc } from "@/lib/legal";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const markdown = readLegalDoc(doc);
  return (
    <article className="prose prose-zinc dark:prose-invert mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
