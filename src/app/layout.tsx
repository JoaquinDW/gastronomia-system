import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { hostOrigin, rootDomain } from "@/lib/hosts";
import "./globals.css";
import "./workspace.css";

const title = "Pedipue — tu tienda online, los pedidos directo";
const description =
  "Tu tienda online con link propio y pedidos directo por WhatsApp, sin comisiones de apps de delivery. Para hamburgueserías, rotiserías y casas de pastas.";
const root = rootDomain();

export const metadata: Metadata = {
  metadataBase: root ? new URL(hostOrigin(root)) : undefined,
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "Pedipue",
    locale: "es_AR",
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Pedipue: tu tienda online, los pedidos directo por WhatsApp",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
