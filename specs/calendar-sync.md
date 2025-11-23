# Calendar Sync Specification: The Heat Engine

## Overview
This document outlines the architecture for the Calendar Sync feature in Flow State. Unlike traditional sync systems that rely on linear CRUD (Create, Read, Update, Delete) operations, Flow State utilizes a "Heat Engine" approach to ensure data consistency and idempotency across devices.

## The Problem with CRUD
In a distributed, local-first system like Flow State, relying on event-by-event updates (e.g., "Event A moved to 2 PM") is fragile. Network interruptions, race conditions, or missed webhooks can lead to desynchronized states ("drift").

## The Solution: Heat Engine
The Heat Engine treats time as a continuous resource rather than discrete objects. Instead of syncing "events", we sync the "state of time" within a window.

### Core Concept: `reconcileHeat`
The central function of this engine is `reconcileHeat(windowStart, windowEnd, sourceEvents)`.

**Process:**
1.  **Window Definition**: The system defines a time window (e.g., "Next 7 Days").
2.  **Heat Calculation**: It calculates the "heat" (density/occupation) of the calendar for that window based on the source of truth (e.g., Google Calendar, iOS Calendar).
3.  **Snapshot Comparison**: This calculated state is compared against the local store's version of that window.
4.  **Reconciliation**:
    *   If the "heat maps" match, no action is taken.
    *   If they differ, the *entire window* is recalculated and updated.

### Benefits
*   **Idempotency**: Running the sync multiple times produces the same result. There is no risk of duplicating events or applying updates twice.
*   **Self-Healing**: If a sync fails, the next `reconcileHeat` pass will detect the discrepancy in the window and correct it automatically.
*   **Simplicity**: We avoid complex conflict resolution logic for individual fields. The "Source" (External Calendar) is always the authority for the layout of the window.

## Data Flow
1.  **Trigger**: Sync is triggered (periodically or via webhook).
2.  **Fetch**: `CalendarService` fetches raw events for the target window.
3.  **Compute**: The Heat Engine processes these events into a normalized "Heat Map".
4.  **Commit**: The normalized map replaces the local state for that time range.

## Implementation Details
The `reconcileHeat` function should be implemented in `src/lib/sync/heat-engine.ts` (or equivalent) and used by the background sync worker.
