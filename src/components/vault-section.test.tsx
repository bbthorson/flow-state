import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { VaultSection } from './vault-section';
import { useAppStore } from '@/store/useAppStore';
import { STALE_BACKUP_DAYS } from '@/lib/vault';

const DAY = 24 * 60 * 60 * 1000;

describe('VaultSection backup freshness', () => {
  beforeEach(() => {
    useAppStore.setState({ lastBackupTimestamp: null });
  });

  it('warns when no backup has ever been taken', () => {
    render(<VaultSection />);
    expect(screen.getByText(/No backup yet/)).toBeInTheDocument();
  });

  it('warns once a backup is older than the threshold', () => {
    // lastBackupTimestamp was written on every export and read by nothing, so
    // this warning did not exist at all before.
    useAppStore.setState({ lastBackupTimestamp: Date.now() - (STALE_BACKUP_DAYS + 2) * DAY });
    render(<VaultSection />);

    expect(screen.getByText(/Export a fresh one/)).toBeInTheDocument();
    expect(screen.getByText(/8 days ago/)).toBeInTheDocument();
  });

  it('is quiet when the backup is recent', () => {
    useAppStore.setState({ lastBackupTimestamp: Date.now() - DAY });
    render(<VaultSection />);

    expect(screen.getByText(/Last backup yesterday/)).toBeInTheDocument();
    expect(screen.queryByText(/Export a fresh one/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No backup yet/)).not.toBeInTheDocument();
  });

  it('is titled with the product term used everywhere else', () => {
    render(<VaultSection />);
    expect(screen.getByRole('heading', { name: 'Vault' })).toBeInTheDocument();
  });
});
