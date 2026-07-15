// Availability calendar: 7 days x 24 hours grid, encoded compactly into a URL
// so users can share their schedule with a link. No backend required.

export type Slots = boolean[][]; // [day 0..6][hour 0..23]

export function emptySlots(): Slots {
  return Array.from({ length: 7 }, () => Array(24).fill(false));
}

// Pack 168 booleans into 21 bytes -> base64url string.
export function encodeSlots(slots: Slots): string {
  const bytes = new Uint8Array(21);
  let bit = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (slots[d][h]) bytes[bit >> 3] |= 1 << (bit & 7);
      bit++;
    }
  }
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSlots(str: string): Slots {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(21);
    for (let i = 0; i < Math.min(21, bin.length); i++) bytes[i] = bin.charCodeAt(i);
    const slots = emptySlots();
    let bit = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        slots[d][h] = (bytes[bit >> 3] & (1 << (bit & 7))) !== 0;
        bit++;
      }
    }
    return slots;
  } catch {
    return emptySlots();
  }
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
