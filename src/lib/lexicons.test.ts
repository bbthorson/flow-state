import { describe, it, expect } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACTION_NSID,
  AUTOMATION_COLLECTION,
  TRIGGER_NSID,
  toAutomationRecord,
} from "./automation-record";
import { STARTER_FLOWS } from "./templates";

/**
 * CLAUDE.md makes src/lexicons the source of truth for the record format. These
 * checks keep the code's NSID tables and the lexicon files from drifting apart.
 */
const ROOT = join(__dirname, "..", "lexicons");

function loadAll(dir: string): Map<string, any> {
  const out = new Map<string, any>();
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) for (const [k, v] of loadAll(path)) out.set(k, v);
    else if (entry.endsWith(".json")) {
      const doc = JSON.parse(readFileSync(path, "utf8"));
      out.set(doc.id, doc);
    }
  }
  return out;
}

const lexicons = loadAll(ROOT);
const automation = lexicons.get(AUTOMATION_COLLECTION);

describe("lexicons", () => {
  it("has a lexicon for every trigger and action the code can write", () => {
    for (const nsid of [...Object.values(TRIGGER_NSID), ...Object.values(ACTION_NSID)]) {
      expect(lexicons.has(nsid), nsid).toBe(true);
    }
  });

  it("lists exactly the code's triggers and actions in the automation record unions", () => {
    const triggerRefs = automation.defs.main.record.properties.trigger.refs;
    const actionRefs = automation.defs.actionStep.properties.action.refs;
    expect([...triggerRefs].sort()).toEqual(Object.values(TRIGGER_NSID).sort());
    expect([...actionRefs].sort()).toEqual(Object.values(ACTION_NSID).sort());
  });

  it("lists every trigger and action in the shared defs unions", () => {
    const defs = lexicons.get("app.flowstate.defs").defs;
    expect(defs.triggerInput.refs).toEqual(expect.arrayContaining(Object.values(TRIGGER_NSID)));
    expect(defs.actionInput.refs).toEqual(expect.arrayContaining(Object.values(ACTION_NSID)));
  });

  it("writes every field a trigger or action lexicon requires", () => {
    // Starter flows plus the event pair cover every type.
    const flows = [
      ...STARTER_FLOWS,
      {
        name: "events",
        trigger: { type: "EVENT" as const, details: { event: "x" } },
        steps: [
          {
            type: "action" as const,
            id: "a",
            action: { type: "EMIT_EVENT" as const, details: { event: "y" } },
          },
        ],
      },
    ];
    for (const flow of flows) {
      const record = toAutomationRecord(flow);
      const members = [
        record.trigger,
        ...record.steps.filter((s: any) => s.action).map((s: any) => s.action),
      ];
      for (const member of members) {
        const required: string[] = lexicons.get(member.$type)?.defs.main.required ?? [];
        for (const key of required) expect(member, `${member.$type}.${key}`).toHaveProperty(key);
      }
    }
  });
});
