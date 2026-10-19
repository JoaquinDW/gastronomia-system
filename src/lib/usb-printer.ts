// Direct printing to a USB thermal printer with WebUSB (Chrome and Edge on
// a computer). The browser remembers the printer once the user picks it, so
// later orders print without any dialog while the orders page is open.

// The DOM lib doesn't ship WebUSB types; this is the part we use.
type UsbEndpoint = { endpointNumber: number; direction: "in" | "out"; type: string };
type UsbInterface = {
  interfaceNumber: number;
  claimed: boolean;
  alternate: { interfaceClass: number; endpoints: UsbEndpoint[] };
};
export type UsbPrinter = {
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(number: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
  forget?(): Promise<void>;
};
type Usb = {
  requestDevice(options: { filters: object[] }): Promise<UsbPrinter>;
  getDevices(): Promise<UsbPrinter[]>;
  addEventListener(type: "connect" | "disconnect", listener: () => void): void;
  removeEventListener(type: "connect" | "disconnect", listener: () => void): void;
};

export const usb = () =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { usb?: Usb }).usb;

export const printerName = (p: UsbPrinter) =>
  p.productName || p.manufacturerName || "Impresora USB";

export class PrinterError extends Error {}

/** Opens Chrome's device picker. Resolves null if the user closes it. */
export async function pickPrinter(): Promise<UsbPrinter | null> {
  try {
    return (await usb()!.requestDevice({ filters: [] })) ?? null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") return null;
    throw e;
  }
}

export async function savedPrinter(): Promise<UsbPrinter | null> {
  return (await usb()?.getDevices().catch(() => []))?.[0] ?? null;
}

// Printers expose one interface with a bulk OUT endpoint; class 7 is the
// standard printer class, but many POS printers report a vendor class.
function outEndpoint(p: UsbPrinter) {
  const candidates = (p.configuration?.interfaces ?? []).flatMap((i) =>
    i.alternate.endpoints
      .filter((e) => e.direction === "out" && e.type === "bulk")
      .map((e) => ({ i, e })),
  );
  return (
    candidates.find((c) => c.i.alternate.interfaceClass === 7) ?? candidates[0]
  );
}

export async function printBytes(p: UsbPrinter, data: Uint8Array) {
  try {
    if (!p.opened) await p.open();
    if (!p.configuration) await p.selectConfiguration(1);
  } catch {
    throw new PrinterError(
      "No pudimos abrir la impresora. Revisá que esté prendida y enchufada.",
    );
  }
  const target = outEndpoint(p);
  if (!target)
    throw new PrinterError("Este aparato USB no parece una impresora.");
  if (!target.i.claimed) {
    try {
      await p.claimInterface(target.i.interfaceNumber);
    } catch {
      throw new PrinterError(
        "La compu no deja usar esta impresora por USB porque la tiene tomada otro programa o su driver.",
      );
    }
  }
  for (let at = 0; at < data.length; at += 4096)
    await p.transferOut(target.e.endpointNumber, data.slice(at, at + 4096));
}

export function concatBytes(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) out.set(p, (at += p.length) - p.length);
  return out;
}
