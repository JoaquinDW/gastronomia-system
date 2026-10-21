import { Brand } from "@/components/brand";
import { appUrl } from "@/lib/hosts";
import { IdentifyUser } from "@/components/identify-user";
import { SignOut } from "@/components/sign-out";
import { requireUser } from "@/server/auth";
import { isSuperadminEmail } from "@/server/superadmin";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="site-shell panel-shell">
      <IdentifyUser id={user.id} email={user.email} name={user.name} />
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <Brand href={appUrl("/panel")} />
        <div className="panel-account">
          {isSuperadminEmail(user.email) ? (
            <a className="panel-admin-link" href={appUrl("/panel/admin")}>
              Superadmin
            </a>
          ) : null}
          <span>{user.name}</span>
          <SignOut />
        </div>
      </header>
      <main id="contenido" className="panel-main">
        {children}
      </main>
      <footer>
        <span>pedipue · tu espacio de gestión</span>
        <span>Cada negocio, con sus propios datos.</span>
      </footer>
    </div>
  );
}
