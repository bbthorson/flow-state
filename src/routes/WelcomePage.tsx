import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, ShieldCheck, Globe, Cpu } from 'lucide-react';

export function WelcomePage() {
  const { loading, error, signIn, skipOnboarding } = useAuthStore();
  const [handleInput, setHandleInput] = useState('');
  const navigate = useNavigate();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (handleInput.trim()) {
      signIn(handleInput.trim());
    }
  };

  const handleSkip = () => {
    skipOnboarding();
    navigate('/flows', { replace: true });
  };

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-5">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Flow State</h1>
            <p className="text-muted-foreground max-w-xs">
              On-device automation with a sovereign data layer. Your rules, your data.
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-start gap-3">
            <Cpu className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Runs locally</p>
              <p className="text-xs text-muted-foreground">Automations execute on your device. No cloud required.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Your data, your server</p>
              <p className="text-xs text-muted-foreground">Sign in to sync flows to your AT Protocol PDS — a personal data server you control.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Share and discover</p>
              <p className="text-xs text-muted-foreground">Publish flows to the network and install automations from people you follow.</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <form onSubmit={handleSignIn} className="space-y-2">
            <Input
              placeholder="yourname.bsky.social"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              className="text-sm"
              disabled={loading}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !handleInput.trim()}
            >
              {loading ? 'Connecting...' : 'Sign in with Bluesky'}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Continue without account
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 text-center">
        <p className="text-[10px] text-muted-foreground">
          Signing in redirects you to your PDS for authentication. No password is stored in this app.
        </p>
      </div>
    </div>
  );
}
