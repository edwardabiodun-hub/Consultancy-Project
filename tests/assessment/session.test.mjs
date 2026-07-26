import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_KEY,
} from "../../lib/assessment/session.ts";

const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

const validAnswers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  coreSystemCount: "twoOrMore",
  organizationShape: "multipleTeams",
  relationshipLedByOwner: true,
  restrictedMarket: false,
  scored: { routineApprovals: 75, workWaiting: "unknown" },
  capacity: {
    source: "exact",
    activities: [
      {
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 2,
        occurrencesPerYear: 12,
        hourlyCost: 100,
      },
      {
        activityId: "precision-reporting-v1",
        category: "reporting",
        people: 2,
        hoursPerOccurrence: 3,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    ],
  },
};

const installStorage = (storage) => {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage,
  });
};

test.afterEach(() => {
  if (originalSessionStorage) {
    Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  } else {
    delete globalThis.sessionStorage;
  }
});

test("loadSession returns null when sessionStorage.getItem throws", () => {
  installStorage({
    getItem() {
      throw new DOMException("Storage unavailable", "SecurityError");
    },
  });

  assert.doesNotThrow(() => loadSession());
  assert.equal(loadSession(), null);
});

test("saveSession does not throw when sessionStorage.setItem throws", () => {
  installStorage({
    setItem(key) {
      assert.equal(key, SESSION_KEY);
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  });

  assert.doesNotThrow(() => saveSession(validAnswers));
});

test("clearSession does not throw when sessionStorage.removeItem throws", () => {
  installStorage({
    removeItem() {
      throw new DOMException("Storage unavailable", "SecurityError");
    },
  });

  assert.doesNotThrow(() => clearSession());
});

test("loadSession rejects invalid JSON", () => {
  installStorage({ getItem: () => "{not-json" });

  assert.equal(loadSession(), null);
});

test("loadSession returns a valid normalized v1 payload", () => {
  installStorage({ getItem: () => JSON.stringify(validAnswers) });

  assert.deepEqual(loadSession(), validAnswers);
});

test("loadSession rejects valid JSON with an invalid stored shape", async (t) => {
  const invalidPayloads = [
    ["scored is null", { ...validAnswers, scored: null }],
    ["scored contains an unsupported value", { ...validAnswers, scored: { item: "yes" } }],
    ["capacity activities are absent", { ...validAnswers, capacity: { source: "exact" } }],
    ["capacity source is unsupported", {
      ...validAnswers,
      capacity: { source: "estimate", activities: [] },
    }],
    ["an activity violates its category contract", {
      ...validAnswers,
      capacity: {
        source: "exact",
        activities: [{ ...validAnswers.capacity.activities[1], people: 0 }],
      },
    }],
    ["an employee band is unsupported", { ...validAnswers, employeeBand: "5000+" }],
    ["a required boolean has the wrong type", {
      ...validAnswers,
      relationshipLedByOwner: "yes",
    }],
  ];

  for (const [name, payload] of invalidPayloads) {
    await t.test(name, () => {
      installStorage({ getItem: () => JSON.stringify(payload) });
      assert.equal(loadSession(), null);
    });
  }
});
