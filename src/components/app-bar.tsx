import { Link } from 'react-router';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 px-4 py-2 backdrop-blur-[4px]">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Flow State</h1>
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
