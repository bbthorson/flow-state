import { Link } from 'react-router';
import { Settings, UserCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

function AuthIndicator() {
  const { did, handle } = useAuthStore();

  if (did && handle) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 px-2" asChild>
        <Link to="/settings">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground">@{handle}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 px-2" asChild>
      <Link to="/settings">
        <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Connect</span>
      </Link>
    </Button>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 px-4 py-2 backdrop-blur-[4px]">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Flow State</h1>
        <div className="flex items-center gap-1">
          <AuthIndicator />
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
