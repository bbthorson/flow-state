import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { TriagePage } from '@/routes/TriagePage';
import { TimelinePage } from '@/routes/TimelinePage';
import { ExecutionPage } from '@/routes/ExecutionPage';
import { FlowsSheet } from '@/components/flows-sheet';
import { PassiveShroud } from '@/components/passive-shroud';

const PANES = [
  { key: 'triage', label: 'Triage', Pane: TriagePage },
  { key: 'timeline', label: 'Timeline', Pane: TimelinePage },
  { key: 'execution', label: 'Execution', Pane: ExecutionPage },
];

const CENTER = 1;

export function CompassShell() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(CENTER);
  const did = useAuthStore((s) => s.did);

  // Open on the center (Timeline) pane.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.clientWidth * CENTER;
  }, []);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (prev === idx ? prev : idx));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <header className="flex items-center justify-between border-b px-2 py-2">
        <PassiveShroud />
        <nav className="flex items-center gap-1">
          {PANES.map((pane, i) => (
            <button
              key={pane.key}
              onClick={() => goTo(i)}
              className={cn(
                'rounded px-2.5 py-1 text-xs transition-colors',
                active === i
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {pane.label}
            </button>
          ))}
        </nav>
        <Link
          to="/settings"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          {did && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
          )}
        </Link>
      </header>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none' }}
        className="flex flex-1 min-h-0 snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {PANES.map(({ key, Pane }) => (
          <section
            key={key}
            className="w-full shrink-0 snap-center overflow-y-auto p-4 pb-24"
          >
            <Pane />
          </section>
        ))}
      </div>

      <FlowsSheet />
    </div>
  );
}
