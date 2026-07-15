"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DAY_LABELS, decodeSlots, emptySlots, encodeSlots, type Slots } from "@/lib/availability";

export default function AvailabilityGrid() {
  const [slots, setSlots] = useState<Slots>(() => emptySlots());
  const [copied, setCopied] = useState(false);
  const dragMode = useRef<"paint" | "erase" | null>(null);

  // Load from URL on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get("cal");
    if (s) setSlots(decodeSlots(s));
    const stored = localStorage.getItem("openrun.cal");
    if (!s && stored) setSlots(decodeSlots(stored));
  }, []);

  // Persist locally + update URL (replace, not push, to avoid history bloat)
  useEffect(() => {
    const encoded = encodeSlots(slots);
    localStorage.setItem("openrun.cal", encoded);
    const url = new URL(window.location.href);
    url.searchParams.set("cal", encoded);
    window.history.replaceState(null, "", url.toString());
  }, [slots]);

  function toggle(d: number, h: number, mode?: "paint" | "erase") {
    setSlots((prev) => {
      const next = prev.map((row) => row.slice());
      const target = mode === "paint" ? true : mode === "erase" ? false : !prev[d][h];
      next[d][h] = target;
      return next;
    });
  }

  function fillTypical() {
    const next = emptySlots();
    // Weekday evenings 17-20, weekend afternoons 12-18
    for (let d = 1; d <= 5; d++) for (let h = 17; h < 20; h++) next[d][h] = true;
    for (const d of [0, 6]) for (let h = 12; h < 18; h++) next[d][h] = true;
    setSlots(next);
  }

  const total = useMemo(() => slots.flat().filter(Boolean).length, [slots]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My hoop availability", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-400">
          {total} hour{total === 1 ? "" : "s"} marked
        </div>
        <div className="flex gap-2">
          <button
            onClick={fillTypical}
            className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
          >
            typical week
          </button>
          <button
            onClick={() => setSlots(emptySlots())}
            className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
          >
            clear
          </button>
          <button
            onClick={share}
            className="text-xs px-2 py-1 rounded bg-orange-500 hover:bg-orange-400 text-black font-semibold"
          >
            {copied ? "copied!" : "share link"}
          </button>
        </div>
      </div>

      <div
        className="overflow-x-auto select-none"
        onMouseUp={() => (dragMode.current = null)}
        onMouseLeave={() => (dragMode.current = null)}
      >
        <div className="inline-grid" style={{ gridTemplateColumns: "auto repeat(24, 18px)" }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-neutral-500 text-center">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
          {DAY_LABELS.map((label, d) => (
            <>
              <div key={`l${d}`} className="text-xs text-neutral-400 pr-2 py-[2px]">
                {label}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const on = slots[d][h];
                return (
                  <div
                    key={`${d}-${h}`}
                    onMouseDown={() => {
                      dragMode.current = on ? "erase" : "paint";
                      toggle(d, h, dragMode.current);
                    }}
                    onMouseEnter={() => {
                      if (dragMode.current) toggle(d, h, dragMode.current);
                    }}
                    onTouchStart={() => toggle(d, h)}
                    className={`h-4 border border-neutral-900 cursor-pointer transition ${
                      on ? "bg-orange-500" : "bg-neutral-800 hover:bg-neutral-700"
                    }`}
                    title={`${label} ${h}:00`}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-neutral-500">
        Click or drag to paint. Your calendar is encoded in the URL — share the link and others see your slots.
      </div>
    </div>
  );
}
