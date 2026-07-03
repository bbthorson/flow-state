import { BlockKind } from '@/types';

export const BLOCK_KIND_ORDER: BlockKind[] = ['focus', 'care', 'triage'];

/**
 * Display metadata for the three day-plan block archetypes. `card` styles the
 * left-accent border + fill; `dot` is a solid swatch for pickers/legends.
 */
export const BLOCK_KINDS: Record<BlockKind, { label: string; card: string; dot: string }> = {
  focus: { label: 'Focus', card: 'border-l-primary bg-primary/5', dot: 'bg-primary' },
  care: { label: 'Care', card: 'border-l-accent bg-accent/10', dot: 'bg-accent' },
  triage: { label: 'Triage', card: 'border-l-muted-foreground/50 bg-muted/40', dot: 'bg-muted-foreground/50' },
};
