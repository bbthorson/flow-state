import { describe, it, expect } from "vite-plus/test";
import { parseAutomationRecord, toAutomationRecord } from "./automation-record";
import { STARTER_FLOWS } from "./templates";

const N = "app.flowstate";

/** A record (wire form) that validates, as a base for targeted mutations. */
const validRecord = () => ({
  $type: `${N}.automation`,
  name: "Low battery alert",
  trigger: { $type: `${N}.trigger.battery`, level: 0.2, charging: false },
  steps: [
    {
      $type: `${N}.automation#actionStep`,
      id: "3lzz2uyvqxk2a",
      action: { $type: `${N}.action.notification`, title: "Battery low" },
    },
  ],
  createdAt: "2026-11-24T00:00:00.000Z",
});

const actionStep = (action: Record<string, unknown>) => ({
  $type: `${N}.automation#actionStep`,
  id: "a1",
  action,
});

describe("parseAutomationRecord", () => {
  it("accepts a well-formed record and converts it to the local shape", () => {
    const result = parseAutomationRecord(validRecord());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.trigger).toEqual({
      type: "NATIVE_BATTERY",
      details: { level: 0.2, charging: false },
    });
    expect(result.recipe.steps[0]).toMatchObject({
      type: "action",
      action: { type: "NOTIFICATION", details: { title: "Battery low" } },
    });
  });

  // The check is worthless if it rejects the app's own output: every starter
  // flow is something a user can create and publish.
  it.each(STARTER_FLOWS.map((f) => [f.name, f] as const))(
    "round-trips the app's own starter flow: %s",
    (_name, flow) => {
      const result = parseAutomationRecord(toAutomationRecord(flow));
      expect(result.ok, result.ok ? "" : result.reason).toBe(true);
      if (result.ok) expect(result.recipe.steps).toEqual(flow.steps.map((s) => ({ ...s })));
    },
  );

  describe("rejects records that would break the app", () => {
    const cases: Array<[string, unknown]> = [
      ["null", null],
      ["a string", "not a record"],
      ["an array", []],
      ["a missing trigger", { ...validRecord(), trigger: undefined }],
      ["a trigger that is not an object", { ...validRecord(), trigger: "NATIVE_BATTERY" }],
      ["a trigger with no $type", { ...validRecord(), trigger: { level: 0.2 } }],
      [
        "a v1-style trigger",
        { ...validRecord(), trigger: { type: "NATIVE_BATTERY", details: {} } },
      ],
      [
        "an unknown trigger type",
        { ...validRecord(), trigger: { $type: "com.example.mindReading" } },
      ],
      ["missing steps", { ...validRecord(), steps: undefined }],
      ["steps not an array", { ...validRecord(), steps: { $type: "x" } }],
      ["an empty steps array", { ...validRecord(), steps: [] }],
      [
        "an unknown step type",
        { ...validRecord(), steps: [{ $type: "com.example.step", id: "x" }] },
      ],
      [
        "an unknown action type",
        { ...validRecord(), steps: [actionStep({ $type: "com.example.launchMissile" })] },
      ],
      ["a missing name", { ...validRecord(), name: undefined }],
      ["an empty name", { ...validRecord(), name: "" }],
      [
        "a condition with no assertions",
        {
          ...validRecord(),
          steps: [{ $type: `${N}.automation#conditionStep`, id: "c1", assertions: [] }],
        },
      ],
      [
        "a variable shadowing a reserved root",
        {
          ...validRecord(),
          steps: [{ $type: `${N}.automation#variableStep`, id: "v1", name: "trigger" }],
        },
      ],
    ];

    it.each(cases)("%s", (_label, record) => {
      expect(parseAutomationRecord(record).ok).toBe(false);
    });
  });

  it("rejects branches nested deeper than the lexicon allows", () => {
    const cond = (then: unknown[]) => ({
      $type: `${N}.automation#conditionStep`,
      id: Math.random().toString(36).slice(2, 8),
      assertions: [{ field: "time.hour", operator: "gt", value: "1" }],
      then,
    });
    const leaf = actionStep({ $type: `${N}.action.log` });
    const result = parseAutomationRecord({
      ...validRecord(),
      steps: [cond([cond([cond([leaf])])])],
    });
    expect(result.ok).toBe(false);
  });

  describe("per-type detail requirements", () => {
    it("rejects a geolocation trigger with no coordinates", () => {
      // It would install cleanly and then silently never fire, or compare against NaN.
      const result = parseAutomationRecord({
        ...validRecord(),
        trigger: { $type: `${N}.trigger.geolocation`, radius: 100 },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("trigger.details.latitude");
    });

    it("rejects a webhook action with no url", () => {
      const result = parseAutomationRecord({
        ...validRecord(),
        steps: [actionStep({ $type: `${N}.action.webhook`, method: "POST" })],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("url");
    });

    it("rejects a TIME trigger whose time is not HH:MM", () => {
      const result = parseAutomationRecord({
        ...validRecord(),
        trigger: { $type: `${N}.trigger.time`, time: "half past nine" },
      });
      expect(result.ok).toBe(false);
    });
  });

  it("keeps unknown detail keys instead of stripping them", () => {
    // DEEP_LINK matching compares every key of trigger.details against the
    // incoming params, so dropping extras would silently widen what matches.
    const result = parseAutomationRecord({
      ...validRecord(),
      trigger: { $type: `${N}.trigger.deepLink`, event: "arrived", room: "kitchen" },
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.recipe.trigger.details).toEqual({ event: "arrived", room: "kitchen" });
  });

  it("names the offending field so a skipped record can be debugged", () => {
    const result = parseAutomationRecord({ ...validRecord(), name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("name");
  });
});

describe("toAutomationRecord", () => {
  it("never writes a secret variable value", () => {
    const record = toAutomationRecord({
      name: "Hook",
      trigger: { type: "MANUAL", details: {} },
      steps: [
        { type: "variable", id: "v1", name: "token", kind: "secret", value: "should-not-leak" },
        { type: "action", id: "a1", action: { type: "WEBHOOK", details: { url: "{{token}}" } } },
      ],
    });
    expect(JSON.stringify(record)).not.toContain("should-not-leak");
  });

  it("serialises triggers, steps and actions as $type union members", () => {
    const record = toAutomationRecord({
      name: "x",
      trigger: { type: "DEVICE_MOTION", details: { gesture: "SHAKE" } },
      steps: [{ type: "action", id: "a1", action: { type: "WEB_SHARE", details: { text: "hi" } } }],
    });
    expect(record.trigger).toEqual({ $type: `${N}.trigger.motion`, gesture: "SHAKE" });
    expect(record.steps[0]).toEqual({
      $type: `${N}.automation#actionStep`,
      id: "a1",
      action: { $type: `${N}.action.share`, text: "hi" },
    });
  });
});
