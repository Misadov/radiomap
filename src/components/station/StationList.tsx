'use client';

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Station } from '@/lib/types';
import { stationAt, useData } from '@/store/data';
import { ROW_HEIGHT, StationRow } from './StationRow';

/** The scrolling element of the panel, shared with virtualised lists inside it. */
export const ScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

type Item = number | Station;

export function StationList({ items, limit }: { items: Item[]; limit?: number }) {
  const scrollRef = useContext(ScrollContext);
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const [attempt, retry] = useState(0);
  // Re-resolve stations when stream urls / ids arrive.
  useData((s) => s.version);

  const shown = limit ? items.slice(0, limit) : items;
  const queue = useMemo(
    () => items.map((it) => (typeof it === 'number' ? it : it.index)).filter((i) => i >= 0),
    [items],
  );

  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = scrollRef?.current;
    if (!list || !scroller) {
      // The panel's ref is attached after its children mount: try again next frame.
      if (attempt > 30) return;
      const id = requestAnimationFrame(() => retry((n) => n + 1));
      return () => cancelAnimationFrame(id);
    }
    const measure = () => {
      const top = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setMargin((m) => (Math.abs(m - top) > 0.5 ? top : m));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
    return () => ro.disconnect();
  }, [scrollRef, attempt]);

  // eslint-disable-next-line react-hooks/incompatible-library -- not using the React Compiler
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: margin,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const item = shown[row.index];
        const station = typeof item === 'number' ? stationAt(item) : item;
        return (
          <div
            key={typeof item === 'number' ? item : `s:${item.id}`}
            className="absolute top-0 right-0 left-0"
            style={{ transform: `translateY(${row.start - margin}px)`, height: ROW_HEIGHT }}
          >
            <StationRow station={station} queue={queue} />
          </div>
        );
      })}
    </div>
  );
}

export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1 px-2.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ height: ROW_HEIGHT - 4, opacity: 1 - i * 0.09 }}>
          <div className="skeleton size-[42px] rounded-[11px]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3 w-[55%] rounded-full" />
            <div className="skeleton h-2.5 w-[35%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
