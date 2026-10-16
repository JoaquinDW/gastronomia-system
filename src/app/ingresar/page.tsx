import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/server/auth";

export const metadata = { title: "Ingresá — Pedipue" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/panel");
  return (
    <AccountShell login>
      <AuthForm mode="login" />
    </AccountShell>
  );
}
