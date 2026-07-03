import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings, Music, CreditCard, Ticket } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { SettingsPanel } from '@/components/settings-panel';

/**
 * The Control drawer — a swipe-down / gear-triggered top sheet. It holds the
 * eyes-free "passive" utility layer (media, transit, wallet — placeholder until
 * those integrations land) and the full Settings surface. Triggered by the gear
 * in the compass header; deep-linkable via `/?panel=control`.
 */
export function ControlDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const did = useAuthStore((s) => s.did);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          title="Controls & settings"
        >
          <Settings className="h-4 w-4" />
          {did && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="top" className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Controls</SheetTitle>
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
          An eyes-free layer for media, transit, and wallet. Coming soon.
        </p>

        <SettingsPanel />
      </SheetContent>
    </Sheet>
  );
}
