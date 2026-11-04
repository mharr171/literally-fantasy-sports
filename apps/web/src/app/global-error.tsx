"use client";

/**
 * Last resort when even the site's frame fails (M6). It replaces the whole
 * page, so it carries its own minimal styles.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: "32rem",
          margin: "4rem auto",
          padding: "0 1rem",
          lineHeight: 1.5,
        }}
      >
        <title>Something went wrong · LiterallyFantasySports</title>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Something went wrong.
        </h1>
        <p>
          LiterallyFantasySports couldn&apos;t load. Please try again in a
          moment.
        </p>
        <p style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
          {/* A full reload: the app's router isn't available here. */}
          <a href="/">Home</a>
        </p>
      </body>
    </html>
  );
}
