export function AppBar() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border bg-background/95 p-4 backdrop-blur-[4px] transition-all duration-700"
    >
      <div className="mx-auto flex items-center justify-center">
        <h1 className="text-2xl font-bold">Flow State</h1>
      </div>    
    </header>
  );
}
