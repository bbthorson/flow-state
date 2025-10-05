import React from 'react';

interface AppBarProps {
  children: React.ReactNode;
}

export function AppBar({ children }: AppBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 p-4 backdrop-blur-[4px] transition-all duration-700">
      <div className="container mx-auto flex items-center justify-between">
        <div className="w-10"></div> {/* Spacer to balance the title */}
        <h1 className="text-2xl font-bold">Flow State</h1>
        {children}
      </div>
    </header>
  );
}
