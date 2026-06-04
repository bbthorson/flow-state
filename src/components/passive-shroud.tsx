import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronDown, Music, CreditCard, Ticket } from 'lucide-react';

/**
 * The swipe-down "Passive Shroud" — an eyes-free utility layer for media,
 * transit, and wallet. Placeholder until those integrations land.
 */
export function PassiveShroud() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Passive utilities">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>Passive Shroud</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: Music, label: 'Media' },
            { Icon: Ticket, label: 'Transit' },
            { Icon: CreditCard, label: 'Wallet' },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-muted-foreground"
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          An eyes-free layer for media, transit, and wallet. Coming in a later phase.
        </p>
      </SheetContent>
    </Sheet>
  );
}
