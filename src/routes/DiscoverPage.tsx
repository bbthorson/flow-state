import { StarterPacks } from '@/components/starter-packs';

export function DiscoverPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Discover</h2>
        <p className="text-muted-foreground">
          Pre-built automations you can install with one tap.
        </p>
      </div>
      <StarterPacks />
    </div>
  );
}
