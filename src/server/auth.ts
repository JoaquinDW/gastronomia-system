import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { appUrl, sessionCookieDomain } from "@/lib/hosts";

let auth: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  if (!auth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret || secret.length < 32)
      throw new Error("Auth configuration unavailable");
    auth = createNeonAuth({
      baseUrl,
      cookies: { secret, domain: sessionCookieDomain() },
      logLevel: "silent",
    });
  }
  return auth;
}

export const currentUser = cache(async () => {
  const { data, error } = await getAuth().getSession();
  if (error)
    throw new Error("No pudimos comprobar tu sesión. Volvé a intentar.");
  return data?.user ?? null;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect(appUrl("/ingresar"));
  return user;
}
