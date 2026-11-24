import type { Agent } from '@atproto/api';
import type { Flow, FlowRecipe } from '@/types';
import { AUTOMATION_COLLECTION, parseAutomationRecord, toAutomationRecord } from '@/lib/automation-record';
import { sanitizeForRecipeExport } from '@/lib/recipe';

/**
 * A recipe read off someone's PDS. Only `app.flowstate.automation` (v2) records
 * are read; v1 `app.flowstate.flow` records are ignored.
 */
export interface PublishedFlow extends FlowRecipe {
  uri: string;
  did: string;
  rkey: string;
}

/** The record for a flow: its shareable content, with secrets and local state dropped. */
export function flowToRecord(flow: Flow) {
  return toAutomationRecord({ ...sanitizeForRecipeExport(flow), active: flow.active, dryRun: false, createdAt: flow.createdAt });
}

/**
 * Parse one record. Returns null for anything that doesn't validate: these come
 * from other people's PDSes, so "trust the shape" is not available to us.
 */
function recordToFlow(uri: string, value: unknown): PublishedFlow | null {
  const parsed = parseAutomationRecord(value);
  if (!parsed.ok) {
    console.warn(`[flow-state] Skipping malformed flow record ${uri} — ${parsed.reason}`);
    return null;
  }
  const [, , did, , rkey] = uri.split('/');
  return { ...parsed.recipe, id: uri, authorDid: did, uri, did, rkey };
}

/** True for a record in the superseded v1 `app.flowstate.flow` collection. */
export function isLegacyFlowUri(uri: string): boolean {
  return uri.split('/')[3] === 'app.flowstate.flow';
}

/** Publish a flow to the authenticated user's PDS. */
export async function publishFlow(agent: Agent, flow: Flow): Promise<{ uri: string; cid: string }> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: AUTOMATION_COLLECTION,
    record: flowToRecord(flow),
  });
  return { uri: response.data.uri, cid: response.data.cid };
}

/** Overwrite an already published automation in place, keeping its URI. */
export async function updatePublishedFlow(agent: Agent, rkey: string, flow: Flow): Promise<{ uri: string }> {
  const response = await agent.com.atproto.repo.putRecord({
    repo: agent.assertDid,
    collection: AUTOMATION_COLLECTION,
    rkey,
    record: flowToRecord(flow),
  });
  return { uri: response.data.uri };
}

/**
 * Remove a published flow. Takes the AT URI so entries published to the v1
 * `app.flowstate.flow` collection can still be removed.
 */
export async function unpublishFlow(agent: Agent, uri: string): Promise<void> {
  const [, , , collection, rkey] = uri.split('/');
  await agent.com.atproto.repo.deleteRecord({ repo: agent.assertDid, collection, rkey });
}

/** List all automations published by a given DID. */
export async function listPublishedFlows(agent: Agent, did: string): Promise<PublishedFlow[]> {
  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection: AUTOMATION_COLLECTION,
    limit: 100,
  });
  // One bad record must not cost us the rest of this account's flows.
  return response.data.records
    .map((r) => recordToFlow(r.uri, r.value))
    .filter((flow): flow is PublishedFlow => flow !== null);
}

/** List flows published by people the authenticated user follows. */
export async function discoverFlowsFromFollows(agent: Agent): Promise<PublishedFlow[]> {
  const did = agent.assertDid;

  // Fetch the user's follows
  let cursor: string | undefined;
  const followDids: string[] = [];

  do {
    const response = await agent.getFollows({ actor: did, limit: 100, cursor });
    for (const follow of response.data.follows) {
      followDids.push(follow.did);
    }
    cursor = response.data.cursor;
  } while (cursor);

  // Fetch flows from each followed user (in parallel, batched)
  const flows: PublishedFlow[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < followDids.length; i += BATCH_SIZE) {
    const batch = followDids.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((followDid) => listPublishedFlows(agent, followDid)),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        flows.push(...result.value);
      }
    }
  }

  return flows;
}
