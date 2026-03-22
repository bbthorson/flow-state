import { Link } from 'react-router';
import { StarterPacks } from '@/components/starter-packs';
import { NetworkFlows } from '@/components/network-flows';
import { BookOpen } from 'lucide-react';

export function DiscoverPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Discover</h2>
        <p className="text-muted-foreground">
          Pre-built automations you can install with one tap.
        </p>
      </div>
      <NetworkFlows />
      <StarterPacks />
      <div className="text-center pt-2">
        <Link
          to="/docs/flows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Learn how flows work
        </Link>
      </div>
    </div>
  );
}
