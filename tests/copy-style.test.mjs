import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const visitorFacingFiles = [
  "app/page.tsx",
  "app/about/page.tsx",
  "app/diagnostic/page.tsx",
  "app/how-i-help/page.tsx",
  "app/founder-resources/page.tsx",
  "app/assessment/AssessmentFlow.tsx",
  "app/assessment/BandedCapacityInputs.tsx",
  "app/api/contact/route.ts",
  "content/resource-articles.ts",
  "content/resources.ts",
];

test("visitor-facing copy avoids em dashes and obvious AI-style wording", async () => {
  const prohibited = [
    ["em dash", /—/],
    ["leverage", /\bleverage\b/i],
    ["enabling mechanism", /\benabling mechanism\b/i],
  ];

  for (const file of visitorFacingFiles) {
    const source = await readFile(file, "utf8");

    for (const [label, pattern] of prohibited) {
      assert.doesNotMatch(source, pattern, `${file} contains ${label}`);
    }
  }
});

