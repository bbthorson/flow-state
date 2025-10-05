import { Button } from '@/components/ui/button';
import { Home, Settings } from 'lucide-react';

interface AppBarProps {
  activeScreen: 'status' | 'settings';
  setActiveScreen: (screen: 'status' | 'settings') => void;
}

export function AppBar({ activeScreen, setActiveScreen }: AppBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 p-4 backdrop-blur-[4px] transition-all duration-700">
      <div className="container mx-auto flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setActiveScreen('status')}
          className={activeScreen === 'status' ? 'text-primary font-bold' : ''}
        >
          <Home className="mr-2 h-4 w-4" />
          Device Status
        </Button>
        <h1 className="text-2xl font-bold">Flow State</h1>
        <Button
          variant="ghost"
          onClick={() => setActiveScreen('settings')}
          className={activeScreen === 'settings' ? 'text-primary font-bold' : ''}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
    </header>
  );
}
