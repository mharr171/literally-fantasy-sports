import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("soccer's old links (D191)", () => {
  it("send every old page and anything under it to /soccer", async () => {
    const rules = await nextConfig.redirects?.();
    expect(rules).toEqual(
      ["team", "season", "leaderboard", "hall-of-fame", "guide"].map(
        (page) => ({
          source: `/${page}/:path*`,
          destination: `/soccer/${page}/:path*`,
          permanent: true,
        }),
      ),
    );
  });
});
