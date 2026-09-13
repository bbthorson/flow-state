import { describe, it, expect } from 'vitest';
import { backupStatus, describeBackupAge, STALE_BACKUP_DAYS } from './vault';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 20);

describe('backupStatus', () => {
  it('reports no backup when nothing has been exported', () => {
    expect(backupStatus(null, NOW)).toEqual({ state: 'none' });
  });

  it('treats a same-day backup as fresh', () => {
    expect(backupStatus(NOW - 1000, NOW)).toEqual({ state: 'fresh', daysAgo: 0 });
  });

  it('is still fresh the day before the threshold', () => {
    const status = backupStatus(NOW - (STALE_BACKUP_DAYS - 1) * DAY, NOW);
    expect(status).toEqual({ state: 'fresh', daysAgo: STALE_BACKUP_DAYS - 1 });
  });

  it('goes stale exactly on the threshold', () => {
    const status = backupStatus(NOW - STALE_BACKUP_DAYS * DAY, NOW);
    expect(status).toEqual({ state: 'stale', daysAgo: STALE_BACKUP_DAYS });
  });

  it('stays stale well past the threshold', () => {
    expect(backupStatus(NOW - 40 * DAY, NOW)).toEqual({ state: 'stale', daysAgo: 40 });
  });

  it('does not report a negative age when the stamp is in the future', () => {
    // A clock change, or a vault imported from a device set ahead.
    expect(backupStatus(NOW + 5 * DAY, NOW)).toEqual({ state: 'fresh', daysAgo: 0 });
  });
});

describe('describeBackupAge', () => {
  it('reads naturally for recent backups', () => {
    expect(describeBackupAge(0)).toBe('today');
    expect(describeBackupAge(1)).toBe('yesterday');
    expect(describeBackupAge(8)).toBe('8 days ago');
  });
});
