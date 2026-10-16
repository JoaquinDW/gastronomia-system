import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gastronomía — el comienzo de una buena operación",
  description:
    "Plan de V1 y base técnica para negocios gastronómicos independientes.",
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
