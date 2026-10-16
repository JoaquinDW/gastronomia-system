import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/server/auth";
import { safeNext } from "@/lib/hosts";

export const metadata = { title: "Ingresá — Pedipue" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next) ?? undefined;
  if (await currentUser()) redirect(next ?? "/panel");
  return (
    <AccountShell login>
      <AuthForm mode="login" next={next} />
    </AccountShell>
  );
}
