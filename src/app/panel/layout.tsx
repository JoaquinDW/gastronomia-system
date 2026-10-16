import { Brand } from "@/components/brand";
import { SignOut } from "@/components/sign-out";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="site-shell panel-shell">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <Brand />
        <div className="panel-account">
          <span>{user.name}</span>
          <SignOut />
        </div>
      </header>
      <main id="contenido" className="panel-main">
        {children}
      </main>
      <footer>
        <span>gastronomía · tu espacio de gestión</span>
        <span>Cada negocio, con sus propios datos.</span>
      </footer>
    </div>
  );
}
