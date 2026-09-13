/**
 * Backup freshness.
 *
 * `useAppStore.lastBackupTimestamp` has always been written on export and never
 * read, so the warning the constitution promises ("a red indicator appears if a
 * backup hasn't been downloaded in 6 days") did not exist. Six days is chosen
 * to land just inside the seven-day window after which browsers evict storage
 * for sites the user hasn't visited — the threat the Vault exists to mitigate.
 */
export const STALE_BACKUP_DAYS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupStatus =
  | { state: 'none' }
  | { state: 'fresh'; daysAgo: number }
  | { state: 'stale'; daysAgo: number };

export function backupStatus(
  lastBackupTimestamp: number | null,
  now: number = Date.now(),
): BackupStatus {
  if (!lastBackupTimestamp) return { state: 'none' };

  // A clock change (or a vault imported from a device set to the future) can
  // put the stamp ahead of now; treat that as fresh rather than as a huge
  // negative age.
  const daysAgo = Math.max(0, Math.floor((now - lastBackupTimestamp) / DAY_MS));
  return daysAgo >= STALE_BACKUP_DAYS ? { state: 'stale', daysAgo } : { state: 'fresh', daysAgo };
}

/** "today" / "yesterday" / "8 days ago" — for a backup age in whole days. */
export function describeBackupAge(daysAgo: number): string {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo} days ago`;
}
