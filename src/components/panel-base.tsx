"use client";

import { createContext, useContext } from "react";

// Base de los links de la gestión del local actual: /<slug> con dominios,
// /panel/negocios/<id> sin ellos. La define el layout del negocio.
const PanelBase = createContext("");

export function PanelBaseProvider({
  base,
  children,
}: {
  base: string;
  children: React.ReactNode;
}) {
  return <PanelBase.Provider value={base}>{children}</PanelBase.Provider>;
}

export const usePanelBase = () => useContext(PanelBase);
