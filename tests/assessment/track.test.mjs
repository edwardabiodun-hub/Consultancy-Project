import assert from "node:assert/strict";
import test from "node:test";
import { trackAssessmentEvent } from "../../lib/analytics/track.ts";

// trackAssessmentEvent runs entirely client-side and bails out immediately
// when `window` is undefined, so these tests stub a minimal `window` and
// `navigator` to exercise both delivery paths (sendBeacon and fetch). Every
// global stubbed here is restored after each test so it cannot leak into
// other test files running in the same node --test process.

const withStubs = async ({ hasWindow = true, sendBeacon, fetch: fetchStub } = {}, run) => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;

  if (hasWindow) {
    globalThis.window = previousWindow ?? {};
  } else {
    delete globalThis.window;
  }

  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  if (sendBeacon === undefined) {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
  } else {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { sendBeacon },
    });
  }

  globalThis.fetch = fetchStub ?? previousFetch;

  try {
    await run();
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
    globalThis.fetch = previousFetch;
  }
};

test("trackAssessmentEvent calls navigator.sendBeacon with the events endpoint and a Blob body when useBeacon is true", async () => {
  const calls = [];
  await withStubs(
    {
      sendBeacon: (url, blob) => {
        calls.push({ url, blob });
        return true;
      },
    },
    async () => {
      trackAssessmentEvent(
        "pdf_downloaded",
        { assessmentId: "8d7b76ca-86bf-46a6-88f4-42b6dfecd159", screen: "full" },
        { useBeacon: true },
      );
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/assessment/events");
  assert.ok(calls[0].blob instanceof Blob);
  assert.equal(calls[0].blob.type, "application/json");
  const text = await calls[0].blob.text();
  assert.deepEqual(JSON.parse(text), {
    eventName: "pdf_downloaded",
    assessmentId: "8d7b76ca-86bf-46a6-88f4-42b6dfecd159",
    screen: "full",
  });
});

test("trackAssessmentEvent uses fetch instead of sendBeacon when useBeacon is not passed", async () => {
  let sendBeaconCalled = false;
  let fetchCall = null;
  await withStubs(
    {
      sendBeacon: () => {
        sendBeaconCalled = true;
        return true;
      },
      fetch: async (url, init) => {
        fetchCall = { url, init };
        return new Response(null, { status: 202 });
      },
    },
    async () => {
      trackAssessmentEvent("assessment_started", {});
    },
  );

  assert.equal(sendBeaconCalled, false);
  assert.ok(fetchCall);
  assert.equal(fetchCall.url, "/api/assessment/events");
  assert.equal(fetchCall.init.method, "POST");
  assert.equal(fetchCall.init.keepalive, true);
  assert.deepEqual(JSON.parse(fetchCall.init.body), { eventName: "assessment_started" });
});

test("trackAssessmentEvent uses fetch instead of sendBeacon when useBeacon is explicitly false", async () => {
  let sendBeaconCalled = false;
  let fetchCalled = false;
  await withStubs(
    {
      sendBeacon: () => {
        sendBeaconCalled = true;
        return true;
      },
      fetch: async () => {
        fetchCalled = true;
        return new Response(null, { status: 202 });
      },
    },
    async () => {
      trackAssessmentEvent("assessment_started", {}, { useBeacon: false });
    },
  );

  assert.equal(sendBeaconCalled, false);
  assert.equal(fetchCalled, true);
});

test("trackAssessmentEvent falls back to fetch when navigator.sendBeacon is not a function, even with useBeacon true", async () => {
  let fetchCalled = false;
  await withStubs(
    {
      sendBeacon: undefined,
      fetch: async () => {
        fetchCalled = true;
        return new Response(null, { status: 202 });
      },
    },
    async () => {
      trackAssessmentEvent("pdf_downloaded", {}, { useBeacon: true });
    },
  );

  assert.equal(fetchCalled, true);
});

test("trackAssessmentEvent does nothing when window is undefined", async () => {
  let sendBeaconCalled = false;
  let fetchCalled = false;
  await withStubs(
    {
      hasWindow: false,
      sendBeacon: () => {
        sendBeaconCalled = true;
        return true;
      },
      fetch: async () => {
        fetchCalled = true;
        return new Response(null, { status: 202 });
      },
    },
    async () => {
      trackAssessmentEvent("assessment_started", {}, { useBeacon: true });
    },
  );

  assert.equal(sendBeaconCalled, false);
  assert.equal(fetchCalled, false);
});
