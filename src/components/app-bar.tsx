import {Clock} from 'lucide-react';

export function AppBar() {
  return (
    <header className="w-full bg-teal p-4 text-white shadow-md">
      <div className="container mx-auto flex items-center justify-center">
        <Clock className="mr-2 h-6 w-6" />
        <h1 className="text-2xl font-semibold">PWA State Tracker</h1>
      </div>
    </header>
  );
}
