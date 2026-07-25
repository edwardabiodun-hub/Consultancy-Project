import assert from "node:assert/strict";
import test from "node:test";

async function request(path = "/", init, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      ...env,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the founder-independence homepage and six-page navigation", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build a business that runs on systems/);
  assert.match(html, /Decision Margin/);
  for (const href of [
    "/diagnostic",
    "/how-i-help",
    "/founder-resources",
    "/about",
    "/contact",
  ]) {
    assert.match(html, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("renders every primary route with unique substantive content", async () => {
  const routes = new Map([
    ["/diagnostic", /10 business days/],
    ["/how-i-help", /Executive visibility/],
    ["/founder-resources", /Build a Business That Runs Without You/],
    ["/about", /The perspective behind the work/],
    ["/contact", /Primary operational dependency/],
  ]);
  for (const [path, expected] of routes) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), expected, path);
  }
});

test("renders the human-led About Eddie page with professional proof", async () => {
  const response = await request("/about");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Clearer decisions\. Stronger operating systems\. Less dependence on one person\./);
  assert.match(html, /src="\/edward-abiodun\.png"/);
  assert.match(html, /alt="Edward Abiodun"/);
  assert.match(html, /linkedin\.com\/in\/edward-abiodun-09600a10/);
  assert.match(html, /Christoph Brand/);
  assert.match(html, /Christian Bischof/);
  assert.match(html, /does not use confidential employer information/i);
  assert.match(html, /Start a focused conversation/);
  assert.match(html, /See the diagnostic/);
});

test("contact endpoint rejects invalid inquiries", async () => {
  const response = await request("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", bottleneck: "Busy" }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.ok(body.errors.email);
  assert.ok(body.errors.bottleneck);
});

test("contact endpoint does not claim delivery when email is not configured", async () => {
  const response = await request("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Eddie Abiodun",
      email: "eddie@example.com",
      company: "Example Co",
      role: "Founder",
      employeeCount: "25–100",
      bottleneck: "Too many operating decisions still depend on the founder.",
      desiredOutcome: "A practical operating system that gives the team more autonomy.",
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.errors.form, /not yet configured/i);
});
