import { AccountShell } from "@/components/account-shell";
import { BusinessForm } from "@/components/business-form";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Registrá tu negocio — Pedipue" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <AccountShell step={2}>
      <BusinessForm email={user.email} />
    </AccountShell>
  );
}
