import { Agent } from '@atproto/api';
import { Flow } from '@/types';

const FLOW_COLLECTION = 'app.flowstate.flow';
const INSTALL_COLLECTION = 'app.flowstate.install';

/** Convert a local flow to an AT Protocol record (strip local-only fields). */
function flowToRecord(flow: Flow) {
  return {
    $type: FLOW_COLLECTION,
    name: flow.name,
    enabled: flow.enabled,
    trigger: flow.trigger,
    actions: flow.actions,
  };
}

/** Convert an AT Protocol flow record back to a local Flow shape. */
function recordToFlow(uri: string, record: any): PublishedFlow {
  const [, , did, , rkey] = uri.split('/');
  return {
    uri,
    did,
    rkey,
    name: record.name,
    enabled: record.enabled,
    trigger: record.trigger,
    actions: record.actions,
  };
}

export interface PublishedFlow {
  uri: string;
  did: string;
  rkey: string;
  name: string;
  enabled: boolean;
  trigger: Flow['trigger'];
  actions: Flow['actions'];
}

/** Publish a flow to the authenticated user's PDS. */
export async function publishFlow(agent: Agent, flow: Flow): Promise<{ uri: string; cid: string }> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: FLOW_COLLECTION,
    record: flowToRecord(flow),
  });
  return { uri: response.data.uri, cid: response.data.cid };
}

/** Remove a published flow from the authenticated user's PDS. */
export async function unpublishFlow(agent: Agent, rkey: string): Promise<void> {
  await agent.com.atproto.repo.deleteRecord({
    repo: agent.assertDid,
    collection: FLOW_COLLECTION,
    rkey,
  });
}

/** List all flows published by a given DID. */
export async function listPublishedFlows(agent: Agent, did: string): Promise<PublishedFlow[]> {
  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection: FLOW_COLLECTION,
    limit: 100,
  });
  return response.data.records.map((r) => recordToFlow(r.uri, r.value));
}

/** Write an install record to the authenticated user's PDS. */
export async function recordInstall(agent: Agent, flowUri: string): Promise<{ uri: string }> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: INSTALL_COLLECTION,
    record: {
      $type: INSTALL_COLLECTION,
      flowUri,
      installedAt: new Date().toISOString(),
    },
  });
  return { uri: response.data.uri };
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
