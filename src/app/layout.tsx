import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Pedipue — tu tienda online, los pedidos directo",
  description:
    "Tu tienda online con link propio y pedidos directo por WhatsApp, sin comisiones de apps de delivery. Para hamburgueserías, rotiserías y casas de pastas.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
