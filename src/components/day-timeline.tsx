import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { TimeBlock, BlockKind } from '@/types';
import { toMinutes, nowHHMM } from '@/lib/schedule';
import { BLOCK_KINDS, BLOCK_KIND_ORDER } from '@/lib/blocks';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type EditorTarget = TimeBlock | 'new' | null;

export function DayTimeline() {
  const blocks = useAppStore((s) => s.blocks);
  const [editing, setEditing] = useState<EditorTarget>(null);
  const [now, setNow] = useState(() => new Date());

  // Advance the "now" marker each minute while mounted.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const nowMin = toMinutes(nowHHMM(now));
  const nowIndex = sorted.findIndex((b) => toMinutes(b.start) > nowMin);
  const nowMarkerAt = nowIndex === -1 ? sorted.length : nowIndex;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Your day</h3>
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add block
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No blocks planned"
          description="Add Focus, Care, and Triage blocks to shape your day."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((block, i) => (
            <div key={block.id}>
              {i === nowMarkerAt && <NowMarker time={nowHHMM(now)} />}
              <BlockRow
                block={block}
                current={nowMin >= toMinutes(block.start) && nowMin < toMinutes(block.end)}
                onClick={() => setEditing(block)}
              />
            </div>
          ))}
          {nowMarkerAt === sorted.length && <NowMarker time={nowHHMM(now)} />}
        </div>
      )}

      <BlockEditor target={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function NowMarker({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-semibold tabular-nums text-primary">{time}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      <div className="h-px flex-1 bg-primary/60" />
    </div>
  );
}

function BlockRow({ block, current, onClick }: { block: TimeBlock; current: boolean; onClick: () => void }) {
  const kind = BLOCK_KINDS[block.kind];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md border border-l-4 p-3 text-left transition-colors',
        kind.card,
        current && 'ring-1 ring-primary',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{block.title}</span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {kind.label}
          </span>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {block.start}–{block.end}
          {current && <span className="ml-1 text-primary">· now</span>}
        </div>
      </div>
    </button>
  );
}

function BlockEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const addBlock = useAppStore((s) => s.addBlock);
  const updateBlock = useAppStore((s) => s.updateBlock);
  const deleteBlock = useAppStore((s) => s.deleteBlock);

  const existing = target && target !== 'new' ? target : null;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BlockKind>('focus');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');

  // Sync local form state whenever the editor opens for a new target.
  useEffect(() => {
    if (target === 'new') {
      setTitle('');
      setKind('focus');
      setStart('09:00');
      setEnd('10:00');
    } else if (target) {
      setTitle(target.title);
      setKind(target.kind);
      setStart(target.start);
      setEnd(target.end);
    }
  }, [target]);

  const valid = title.trim().length > 0 && toMinutes(end) > toMinutes(start);

  const handleSave = () => {
    if (!valid) return;
    const data = { title: title.trim(), kind, start, end };
    if (existing) {
      updateBlock({ ...existing, ...data });
    } else {
      addBlock(data);
    }
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit block' : 'New block'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deep work" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {BLOCK_KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors',
                    kind === k ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', BLOCK_KINDS[k].dot)} />
                  {BLOCK_KINDS[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start</label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End</label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {toMinutes(end) <= toMinutes(start) && (
            <p className="text-xs text-destructive">End time must be after start time.</p>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {existing ? (
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                deleteBlock(existing.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={!valid}>
            {existing ? 'Save' : 'Add block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
