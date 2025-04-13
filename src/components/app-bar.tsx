export function AppBar({children}: {children: React.ReactNode}) {
  return (
    <header className="relative w-full bg-muted p-4 text-foreground shadow-md">
      <div className="container mx-auto flex items-center justify-center">
        <h1 className="text-2xl font-semibold">Flow State</h1>
        {children}
      </div>
    </header>
  );
}
