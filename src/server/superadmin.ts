import "server-only";
import { notFound } from "next/navigation";
import { currentUser, requireUser } from "./auth";

// Superadmin: los emails de SUPERADMIN_EMAILS (separados por coma) ven todos
// los negocios. Sin la variable, solo la cuenta del creador de Pedipue.
// Agregá solo emails con cuenta ya creada: el registro no verifica el email.
const defaultSuperadmins = "balthasardeweert@gmail.com";

export function superadminEmails(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS ?? defaultSuperadmins;
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperadminEmail(email: string | null | undefined): boolean {
  return !!email && superadminEmails().has(email.trim().toLowerCase());
}

export async function isSuperadmin(): Promise<boolean> {
  const user = await currentUser().catch(() => null);
  return isSuperadminEmail(user?.email);
}

// Para cualquier otra cuenta la pantalla no existe.
export async function requireSuperadmin() {
  const user = await requireUser();
  if (!isSuperadminEmail(user.email)) notFound();
  return user;
}
