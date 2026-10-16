import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/server/auth";

export const metadata = { title: "Creá tu cuenta — Gastronomía" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/alta");
  return (
    <AccountShell>
      <AuthForm mode="register" />
    </AccountShell>
  );
}
