import { DevicePermission, PermissionState, PERMISSION_LABELS } from '@/lib/permissions';

/**
 * Inline affordance for a single not-yet-granted permission: a Grant link when
 * promptable, or a short explanatory note when denied/unavailable. Shared by the
 * flow form and the starter-flow cards, which had copied this logic.
 */
export function PermissionHint({
  permission,
  state,
  onRequest,
}: {
  permission: DevicePermission;
  state: PermissionState;
  onRequest: (permission: DevicePermission) => void;
}) {
  if (state === 'granted') return null;

  const label = PERMISSION_LABELS[permission];

  if (state === 'unavailable') {
    return <span className="text-[10px] text-destructive">{label} — not supported on this device</span>;
  }

  if (state === 'denied') {
    return <span className="text-[10px] text-destructive">{label} — enable in browser settings</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onRequest(permission)}
      className="text-[10px] text-blue-500 hover:underline"
    >
      Grant {label}
    </button>
  );
}
