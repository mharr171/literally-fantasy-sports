import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_DENIED_PATH, isAdminPath } from "@/lib/admin-path";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session cookie on each request so Server Components
 * always see a valid session, and keeps everyone but admins out of /admin
 * (D21): signed-out visitors go to sign in, other players get a 404.
 * Admin pages and the database check again; this is the first gate.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  const adminArea = isAdminPath(request.nextUrl.pathname);
  if (!env) {
    return adminArea
      ? NextResponse.rewrite(new URL(ADMIN_DENIED_PATH, request.url))
      : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not add code between createServerClient and getClaims: getClaims
  // validates the session and triggers the cookie refresh above.
  const { data } = await supabase.auth.getClaims();

  if (!adminArea) return response;

  let target: NextResponse | null = null;
  if (!data?.claims) {
    const signIn = new URL("/sign-in", request.url);
    target = NextResponse.redirect(signIn);
  } else {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) {
      target = NextResponse.rewrite(new URL(ADMIN_DENIED_PATH, request.url));
    }
  }
  if (!target) return response;
  // Keep any refreshed session cookies.
  for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
