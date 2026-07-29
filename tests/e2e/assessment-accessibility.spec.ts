import { test, expect, type Page } from "@playwright/test";

// Real-browser accessibility verification for the Business Independence
// Assessment (Task 12, Step 2 of the implementation plan). Everything jsdom
// can simulate is already covered by tests/component/*.test.mjs. This file
// covers only what a real rendered, styled, laid-out browser can prove:
// keyboard-only completion of the flow, focus movement, real computed CSS
// contrast, prefers-reduced-motion behavior, and mobile-viewport overflow.

/** Focuses an element via its accessible role/name and activates it with the
 * keyboard (never a pointer click), matching how a keyboard-only visitor
 * would operate the control. */
async function pressKey(page: Page, locator: ReturnType<Page["getByRole"]>, key: string) {
  await locator.focus();
  await page.keyboard.press(key);
}

async function assertSingleH1(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
}

/** Answers the currently-visible question fieldset by keyboard-selecting its
 * first radio option, then advances via the visible primary button. Generic
 * across all 15 required scored questions plus the 2 conditional ones, so it
 * doesn't need to hardcode each question's exact prompt/option text. */
async function answerCurrentQuestion(page: Page) {
  const firstOption = page
    .locator("fieldset.assessment-question input[type=radio]")
    .first();
  await firstOption.focus();
  await page.keyboard.press("Space");
  await expect(firstOption).toBeChecked();

  const advanceButton = page.getByRole("button", {
    name: /^(continue|complete assessment)$/i,
  });
  await advanceButton.focus();
  await page.keyboard.press("Enter");
}

async function completeContextScreen(page: Page) {
  await assertSingleH1(page);
  await expect(page.locator("h1")).toHaveText("Set the operating context.");

  await page.getByLabel("Employees").selectOption("20-49");
  await page.getByLabel("People managers").selectOption("3-5");
  await page.getByLabel("Annual revenue").selectOption("5m-20m");
  await page.getByLabel("Your role").selectOption("Owner-operator");

  await pressKey(page, page.getByRole("radio", { name: "One primary system" }), "Space");
  await pressKey(page, page.getByRole("radio", { name: "One operating team" }), "Space");

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.focus();
  await page.keyboard.press("Enter");
}

async function completeAllComponentQuestions(page: Page) {
  // 5 required questions per component (owner independence, operating
  // system, information visibility); the 3 conditional questions are
  // deliberately skipped by the context answers chosen above
  // (relationshipLedByOwner=false, organizationShape=singleTeam,
  // coreSystemCount=one), so exactly 15 questions are presented.
  for (let index = 0; index < 15; index += 1) {
    await answerCurrentQuestion(page);
  }
}

/** Fills and submits the contact gate by keyboard. Reused by the main
 * keyboard-flow test (which additionally exercises the consent-omitted
 * error path first) and by tests that just need to reach the full-result
 * screen efficiently. */
async function fillAndSubmitContactGate(page: Page) {
  await page.getByLabel("Name").fill("Accessibility Tester");
  await page.getByLabel("Work email").fill("tester@example.com");
  await page.getByLabel("Company").fill("Example Co");
  await pressKey(
    page,
    page.getByRole("checkbox", { name: /I consent to generate/ }),
    "Space",
  );

  const submitButton = page.getByRole("button", {
    name: "Continue to full assessment",
  });
  await submitButton.focus();
  await page.keyboard.press("Enter");
}

test.describe("Business Independence Assessment — accessibility", () => {
  test("completes the assessment using only the keyboard, with focus moving to each new heading", async ({
    page,
  }) => {
    await page.goto("/assessment");
    await assertSingleH1(page);
    await expect(page.locator("h1")).toHaveText(
      "How independently can your business operate?",
    );

    // Progress has an accessible name and real accessible text, not just a
    // visual bar.
    const progress = page.getByRole("progressbar");
    await expect(progress).toHaveAttribute(
      "aria-label",
      "Assessment progress from owner-dependent to system-led",
    );
    await expect(progress).toHaveAttribute("aria-valuetext", /.+/);

    const startButton = page.getByRole("button", { name: "Start the assessment" });
    await startButton.focus();
    await page.keyboard.press("Enter");

    // The step region receives focus on every screen transition (see
    // AssessmentFlow.tsx's stepRef.current?.focus()) so assistive tech
    // announces the new screen instead of leaving focus stranded on a
    // button that no longer exists.
    const step = page.getByRole("region", { name: "Assessment step" });
    await expect(step).toBeFocused();
    await assertSingleH1(page);

    await completeContextScreen(page);
    await expect(step).toBeFocused();
    await assertSingleH1(page);

    await completeAllComponentQuestions(page);

    // Preliminary result — no fieldset/legend here, but still one heading
    // and a keyboard-operable primary action.
    await assertSingleH1(page);
    const unlockButton = page.getByRole("button", {
      name: "Unlock my full assessment",
    });
    await unlockButton.focus();
    await page.keyboard.press("Enter");
    await expect(step).toBeFocused();

    // Contact gate: fill required fields by keyboard, deliberately submit
    // once without consent to verify field-level error association and
    // announcement, then correct it and continue.
    await assertSingleH1(page);
    await expect(page.locator("h1")).toHaveText("Where should we send your report?");

    await page.getByLabel("Name").fill("Accessibility Tester");
    await page.getByLabel("Work email").fill("tester@example.com");
    await page.getByLabel("Company").fill("Example Co");

    const submitButton = page.getByRole("button", {
      name: "Continue to full assessment",
    });
    await submitButton.focus();
    await page.keyboard.press("Enter");

    const consentCheckbox = page.locator("#lead-report-consent");
    await expect(consentCheckbox).toHaveAttribute("aria-invalid", "true");
    const describedBy = await consentCheckbox.getAttribute("aria-describedby");
    expect(describedBy).toBe("lead-report-consent-error");
    const errorNode = page.locator(`#${describedBy}`);
    await expect(errorNode).toHaveText(
      "Consent is required to generate and email the report.",
    );

    await pressKey(page, page.getByRole("checkbox", { name: /I consent to generate/ }), "Space");
    await expect(consentCheckbox).not.toHaveAttribute("aria-invalid", "true");

    await submitButton.focus();
    await page.keyboard.press("Enter");
    await expect(step).toBeFocused();

    // Precision screen — skip the optional exact-input path by keyboard.
    await assertSingleH1(page);
    const skipButton = page.getByRole("button", {
      name: /continue without a financial range|skip financial estimate/i,
    });
    await skipButton.focus();
    await page.keyboard.press("Enter");

    // "processing" is a transient screen; wait for the final "full" result.
    await expect(page.locator("h1")).toHaveText(/out of 100|Result incomplete/, {
      timeout: 15_000,
    });
    await assertSingleH1(page);

    // Full result: methodology/limitations disclaimer is genuinely visible
    // (not just present in markup with zero size), and — since this local
    // server has no D1 binding configured — the print fallback (not a
    // broken "Download executive summary" link) is what's actually shown.
    await expect(
      page.getByText(/Methodology 1\.0\.0 applies deterministic rules/i),
    ).toBeVisible();
    await expect(page.getByText(/not an audit/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Print or save as PDF" }),
    ).toBeVisible();
    await expect(
      page.getByText(/report storage and email delivery is unavailable/i),
    ).toBeVisible();
  });

  /** Computes real WCAG contrast ratios, from live computed styles, for
   * whichever of the given CSS selectors currently match an element on the
   * page. Shared across screens so the same large-text/normal-text
   * thresholds and background-resolution logic apply consistently. */
  async function contrastPairsFor(page: Page, selectors: string[]) {
    return page.evaluate((selectorList: string[]) => {
      const parse = (color: string): [number, number, number] => {
        const match = color.match(/rgba?\(([^)]+)\)/);
        if (!match) return [0, 0, 0];
        const [r, g, b] = match[1].split(",").map((part) => parseFloat(part));
        return [r, g, b];
      };
      const luminance = ([r, g, b]: [number, number, number]) => {
        const channel = (value: number) => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const contrastOf = (foreground: string, background: string) => {
        const l1 = luminance(parse(foreground)) + 0.05;
        const l2 = luminance(parse(background)) + 0.05;
        return l1 > l2 ? l1 / l2 : l2 / l1;
      };
      const backgroundOf = (element: Element): string => {
        let node: Element | null = element;
        while (node) {
          const color = getComputedStyle(node).backgroundColor;
          if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
            return color;
          }
          node = node.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };

      const targets = selectorList
        .map((selector) => document.querySelector(selector))
        .filter((element): element is Element => element !== null);

      return targets.map((element) => {
        const style = getComputedStyle(element);
        const background =
          element.tagName === "BUTTON" ? style.backgroundColor : backgroundOf(element);
        return {
          selector: element.tagName + (element.className ? `.${element.className}` : ""),
          foreground: style.color,
          background,
          ratio: contrastOf(style.color, background),
        };
      });
    }, selectors);
  }

  function assertAA(
    pairs: Array<{ selector: string; foreground: string; background: string; ratio: number }>,
  ) {
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      // WCAG AA: 4.5:1 for normal text, 3:1 for large-scale text (headings,
      // button labels at this size). Use the stricter 4.5 threshold except
      // for the h1, which is unambiguously "large text" under WCAG's
      // 18pt/14pt-bold definition.
      const threshold = pair.selector.startsWith("H1") ? 3 : 4.5;
      expect(
        pair.ratio,
        `${pair.selector}: ${pair.foreground} on ${pair.background} = ${pair.ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(threshold);
    }
  }

  test("meets WCAG AA contrast for primary text/background pairs", async ({ page }) => {
    await page.goto("/assessment");
    assertAA(
      await contrastPairsFor(page, [
        "h1",
        ".assessment-lede",
        ".assessment-kicker",
        "button.button",
      ]),
    );

    // The field-level error text (contact gate) — a distinct red color not
    // covered by the landing-screen sample above.
    const startButton = page.getByRole("button", { name: "Start the assessment" });
    await startButton.focus();
    await page.keyboard.press("Enter");
    await completeContextScreen(page);
    await completeAllComponentQuestions(page);
    await page
      .getByRole("button", { name: "Unlock my full assessment" })
      .click();
    await page.getByRole("button", { name: "Continue to full assessment" }).click();
    await expect(page.locator("#lead-report-consent-error")).toBeVisible();
    assertAA(await contrastPairsFor(page, ["#lead-report-consent-error"]));

    // The full result screen: the richest layout and widest color surface
    // in the flow (component-score bars, priority list, CTA).
    await fillAndSubmitContactGate(page);
    await page
      .getByRole("button", {
        name: /continue without a financial range|skip financial estimate/i,
      })
      .click();
    await expect(page.locator("h1")).toHaveText(/out of 100|Result incomplete/, {
      timeout: 15_000,
    });
    assertAA(
      await contrastPairsFor(page, [
        ".assessment-result-section p",
        ".assessment-route .button",
      ]),
    );
  });

  test("meets WCAG AA contrast on dark surfaces", async ({ page }) => {
    await page.goto("/founder-resources");
    assertAA(
      await contrastPairsFor(page, [
        ".callout .eyebrow",
        ".callout p",
        ".callout .button.secondary",
      ]),
    );

    await page.goto("/");
    assertAA(await contrastPairsFor(page, [".recognition .eyebrow", ".recognition p"]));
  });

  test("respects prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/assessment");

    const transition = await page
      .locator(".assessment-progress > span")
      .evaluate((element) => getComputedStyle(element).transitionDuration);

    // assessment.css declares `transition: none` under
    // `@media (prefers-reduced-motion: reduce)` for this exact element.
    expect(transition === "0s" || transition === "").toBeTruthy();
  });

  test("has no horizontal overflow at a mobile viewport", async ({ page }) => {
    const overflowOf = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/assessment");
    expect(await overflowOf()).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Start the assessment" }).click();
    await completeContextScreen(page);
    expect(await overflowOf()).toBeLessThanOrEqual(1);

    // The full result screen has the most complex layout in the flow
    // (fixed-minimum-width grid tracks in the component-score list), which
    // is exactly the kind of construct most likely to overflow a narrow
    // viewport — the two simple screens above don't exercise that risk.
    await completeAllComponentQuestions(page);
    await page.getByRole("button", { name: "Unlock my full assessment" }).click();
    await fillAndSubmitContactGate(page);
    await page
      .getByRole("button", {
        name: /continue without a financial range|skip financial estimate/i,
      })
      .click();
    await expect(page.locator("h1")).toHaveText(/out of 100|Result incomplete/, {
      timeout: 15_000,
    });
    expect(await overflowOf()).toBeLessThanOrEqual(1);
  });

  test("shows a visible focus indicator on keyboard-focused controls", async ({ page }) => {
    const outlineOf = (locator: ReturnType<Page["locator"]>) =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
      });

    await page.goto("/assessment");

    // Global focus-visible rule (app/globals.css) applies to every native
    // button/input/select/link, including this primary CTA.
    const startButton = page.getByRole("button", { name: "Start the assessment" });
    await startButton.focus();
    const buttonOutline = await outlineOf(startButton);
    expect(buttonOutline.outlineStyle).not.toBe("none");
    expect(parseFloat(buttonOutline.outlineWidth)).toBeGreaterThan(0);

    await page.keyboard.press("Enter");
    await completeContextScreen(page);

    // Radio options additionally get a scoped `:has(input:focus-visible)`
    // outline on the wrapping label (assessment.css), since the input
    // itself is visually small — verify that reinforcement independently.
    const firstOptionLabel = page.locator(".assessment-option").first();
    await firstOptionLabel.locator("input[type=radio]").focus();
    const radioOutline = await outlineOf(firstOptionLabel);
    expect(radioOutline.outlineStyle).not.toBe("none");
    expect(parseFloat(radioOutline.outlineWidth)).toBeGreaterThan(0);
  });
});
