# Founder Independence Advisory Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and privately deploy a polished six-page advisory website that converts founder attention from LinkedIn and YouTube into Owner Independence Scorecard downloads and qualified diagnostic inquiries.

**Architecture:** Use the Sites multi-route starter and its React/vinext structure. Render public pages server-first for speed and search visibility, keep editorial resources in typed local data, and limit client JavaScript to navigation, video consent/loading, scorecard download, and form interactions. Submit inquiries through a validated server endpoint using Resend, with secrets managed as hosted runtime values.

**Tech Stack:** Sites vinext starter, React, TypeScript, CSS custom properties, Vitest, Playwright-compatible browser checks, Resend HTTP API, Sites private hosting.

## Global Constraints

- The website contains exactly six primary navigation pages: Home, Diagnostic, How I Help, Founder Resources, About, and Contact.
- Primary buyer: owner or CEO of a founder-led B2B service business with approximately 20–100 employees.
- Primary message: “Build a business that runs on systems—not constant intervention from you.”
- AI is an enabling mechanism, not the headline product or organizing brand principle.
- The Owner Independence Diagnostic is a 10-business-day pilot priced at $3,500 with initial capacity limited to three clients.
- The offer promises diagnosis, prioritization, and one demonstrated improvement; it does not promise complete owner independence in 10 days.
- The Founder Resources page launches with at least three substantive resources and no more than six embedded YouTube players.
- Every video has a written executive summary, viewing time, practical next action, and related conversion path.
- Use original language and visual identity; do not copy competitor phrases, service names, page compositions, or trademarks.
- Meet WCAG 2.2 AA expectations for contrast, keyboard navigation, form labels, focus states, and media alternatives.
- Avoid generic stock-photo heroes, purple technology gradients, excessive rounded cards, decorative feature-icon grids, and unnecessary animation.
- Do not claim consulting outcomes, client results, valuation multiples, or an advisory track record that cannot be substantiated.
- Exclude KION dealers, direct competitor dealer networks, and overlapping material-handling strategy or intelligence work from client-facing targeting.
- Keep `.env` and `.env.example` keys aligned; hosted secrets are managed through Sites and never committed.
- Finish implementation with a successful production build and private Sites deployment.

---

## File Structure

```text
.
├── .env.example
├── .gitignore
├── .openai/
│   └── hosting.json
├── DESIGN.md
├── app/
│   ├── about/page.tsx
│   ├── api/contact/route.ts
│   ├── contact/page.tsx
│   ├── contact/thank-you/page.tsx
│   ├── diagnostic/page.tsx
│   ├── founder-resources/
│   │   ├── [slug]/page.tsx
│   │   └── page.tsx
│   ├── how-i-help/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   ├── privacy/page.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── ContactForm.tsx
│   ├── DiagnosticSummary.tsx
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── OwnerDependencyMap.tsx
│   ├── ResourceCard.tsx
│   ├── ScorecardCta.tsx
│   ├── SectionIntro.tsx
│   └── VideoEmbed.tsx
├── content/
│   ├── resources.ts
│   └── site-copy.ts
├── lib/
│   ├── contact.ts
│   ├── resources.ts
│   ├── seo.ts
│   └── validation.ts
├── public/
│   ├── favicon.svg
│   ├── owner-independence-scorecard.pdf
│   └── og.png
├── tests/
│   ├── contact.test.ts
│   ├── resources.test.ts
│   ├── seo.test.ts
│   └── validation.test.ts
└── vitest.config.ts
├── docs/
│   └── launch-measurement.md
```

Responsibilities:

- `DESIGN.md` is the source of truth for typography, color, spacing, layout, and motion.
- `content/site-copy.ts` contains reusable navigation, positioning, service, and CTA copy.
- `content/resources.ts` contains the typed launch-resource records.
- `lib/resources.ts` provides resource filtering, featured-resource selection, and slug lookup.
- `lib/validation.ts` validates and normalizes diagnostic inquiry data without UI dependencies.
- `lib/contact.ts` sends validated inquiries through the Resend HTTP API.
- `lib/seo.ts` creates consistent page metadata and structured data.
- `components/` contains focused presentation or interaction units.
- `app/` contains routes and page composition only.

---

### Task 1: Initialize the Hosted Project and Verification Harness

**Files:**
- Create through Sites initializer: `.openai/hosting.json`
- Create through Sites initializer: `package.json`
- Create through Sites initializer: `app/page.tsx`
- Create through Sites initializer: `app/layout.tsx`
- Create through Sites initializer: `app/globals.css`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: Approved design specification at `docs/superpowers/specs/2026-07-24-founder-independence-website-design.md`.
- Produces: A running Sites starter, `npm run test`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 1: Initialize the site once**

Run the Sites root initializer against the current project directory. Retain the generated package manager, lockfile, vinext configuration, and `.openai/hosting.json`. Do not run a second initializer.

Expected: the starter creates a working multi-route React/vinext site.

- [ ] **Step 2: Start the development server**

Run:

```powershell
npm run dev
```

Expected: the starter prints a healthy local URL and renders its temporary loading view.

- [ ] **Step 3: Add the test configuration**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts", "content/**/*.ts"],
    },
  },
});
```

- [ ] **Step 4: Add verification scripts and development dependencies**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Install the test dependency using the starter's package manager:

```powershell
npm install --save-dev vitest
```

Expected: the existing build and dev scripts remain unchanged.

- [ ] **Step 5: Add the runtime-value contract**

Create `.env.example`:

```dotenv
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=
NEXT_PUBLIC_SITE_URL=
```

Ensure `.env` is ignored and `.env.example` is committed.

- [ ] **Step 6: Verify the clean starter**

Run:

```powershell
npm run typecheck
npm run test
npm run build
```

Expected: typecheck and build pass; Vitest exits successfully with no test files.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json .gitignore .env.example .openai app vitest.config.ts
git commit -m "chore: initialize founder independence website"
```

---

### Task 2: Establish the Original Design System and Shared Shell

**Files:**
- Create: `DESIGN.md`
- Create: `components/Header.tsx`
- Create: `components/Footer.tsx`
- Create: `components/SectionIntro.tsx`
- Create: `components/ScorecardCta.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Delete: `app/_sites-preview/`

**Interfaces:**
- Consumes: Six-page navigation labels and positioning from the approved specification.
- Produces: `Header`, `Footer`, `SectionIntro`, `ScorecardCta`, global design tokens, and root metadata used by every route.

- [ ] **Step 1: Prepare three comparable visual directions**

Create exactly three one-shot homepage direction previews outside the site source. Keep the content identical and compare:

1. Editorial Ledger — warm paper neutrals, deep ink, muted copper accent.
2. Operating Blueprint — cool white, navy, technical blue, diagram-led structure.
3. Quiet Authority — soft stone, forest accent, restrained serif/sans pairing.

Reject previews that use generic stock photography, purple gradients, centered-everything layouts, uniform pill cards, or overused primary fonts.

- [ ] **Step 2: Obtain the user's visual selection**

Present the three previews through the site design picker. Record the selected layout, palette, typography, density, and component language. Do not edit product files before selection.

- [ ] **Step 3: Write the design source of truth**

Use the selected preview's complete token set:

| Direction | Display | Body | Data | Canvas | Surface | Ink | Muted ink | Primary | Accent | Rule |
|---|---|---|---|---|---|---|---|---|---|---|
| Editorial Ledger | Instrument Serif 400 | Source Sans 3 400/600 | IBM Plex Mono 500 | `#F5F0E8` | `#FFFDF8` | `#18201D` | `#5D655F` | `#243B33` | `#A65A3A` | `#D8D0C3` |
| Operating Blueprint | Satoshi 600/700 | Geist 400/600 | Geist Mono 500 | `#F4F7FA` | `#FFFFFF` | `#111C2B` | `#526173` | `#163A63` | `#1E6F8C` | `#D5DEE8` |
| Quiet Authority | Fraunces 500/600 | DM Sans 400/500/600 | IBM Plex Mono 500 | `#F3F1EB` | `#FBFAF6` | `#17211B` | `#606A62` | `#244C39` | `#B47742` | `#D7D4CA` |

Create `DESIGN.md` with the values from the selected row:

```md
# Design System — Founder Independence Advisory

## Product Context
- What this is: A credibility and conversion website for an independent founder advisor.
- Who it is for: Owners and CEOs of founder-led B2B service companies with 20–100 employees.
- Project type: Editorial professional-services website.

## Aesthetic Direction
- Direction: The exact title of the selected preview.
- Decoration: Restrained and intentional.
- Mood: Executive rigor with founder accessibility.

## Typography
- Display: Use the selected row's Display value.
- Body: Use the selected row's Body value.
- Data: Use the selected row's Data value.
- Scale: 14, 16, 18, 22, 30, 42, 58 px.

## Color
- Canvas: Use the selected row's Canvas value.
- Surface: Use the selected row's Surface value.
- Ink: Use the selected row's Ink value.
- Muted ink: Use the selected row's Muted ink value.
- Primary: Use the selected row's Primary value.
- Accent: Use the selected row's Accent value.
- Rule: Use the selected row's Rule value.
- Success: #1F7A4D
- Error: #B42318

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96 px.

## Layout
- Maximum content width: 1200px
- Reading width: 720px
- Grid: 12 columns desktop, 6 tablet, 4 mobile.

## Motion
- Approach: Minimal and functional.
- Duration: 120ms micro, 220ms standard, 360ms emphasis.
```

Write literal font names, weights, and hex values into `DESIGN.md`; do not copy
the phrases “Use the selected row” into the file.

- [ ] **Step 4: Write the shared navigation**

Create `components/Header.tsx` with:

```ts
export const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/diagnostic", label: "Diagnostic" },
  { href: "/how-i-help", label: "How I Help" },
  { href: "/founder-resources", label: "Founder Resources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
```

Implement a keyboard-operable mobile menu, visible focus states, `aria-expanded`,
and escape-key close behavior.

- [ ] **Step 5: Write the footer and reusable section components**

The footer must include the six primary links, privacy link, LinkedIn link,
YouTube link, and this boundary statement:

> Independent advisory work only. No confidential employer information is used,
> and engagements within prohibited competitive areas are not accepted.

`SectionIntro` accepts:

```ts
type SectionIntroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};
```

`ScorecardCta` accepts:

```ts
type ScorecardCtaProps = {
  compact?: boolean;
  source: string;
};
```

- [ ] **Step 6: Replace starter metadata and styling**

In `app/layout.tsx`, set:

```ts
export const metadata = {
  title: {
    default: "Edward Abiodun | Founder Independence & Decision Systems",
    template: "%s | Edward Abiodun",
  },
  description:
    "Helping founder-led businesses improve management visibility, document critical workflows, and reduce owner dependence through practical automation.",
};
```

Remove the starter preview component and `codex-preview` metadata. Delete
`app/_sites-preview/` and remove `react-loading-skeleton` if nothing else uses it.

- [ ] **Step 7: Verify the shared shell**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both commands pass and all six primary navigation links are present in
the rendered header and footer.

- [ ] **Step 8: Commit**

```powershell
git add DESIGN.md app components package.json package-lock.json
git commit -m "feat: establish advisory design system"
```

---

### Task 3: Create the Typed Content and SEO Foundation

**Files:**
- Create: `content/site-copy.ts`
- Create: `content/resources.ts`
- Create: `lib/resources.ts`
- Create: `lib/seo.ts`
- Create: `tests/resources.test.ts`
- Create: `tests/seo.test.ts`

**Interfaces:**
- Consumes: Approved positioning, resource categories, and launch-video topics.
- Produces: `Resource`, `ResourceCategory`, `resources`, `getFeaturedResources()`, `getResourceBySlug()`, `createPageMetadata()`, and `createProfessionalServiceJsonLd()`.

- [ ] **Step 1: Write the failing resource tests**

Create `tests/resources.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getFeaturedResources,
  getResourceBySlug,
  resources,
} from "../lib/resources";

describe("launch resources", () => {
  it("ships at least three resources across the approved taxonomy", () => {
    expect(resources.length).toBeGreaterThanOrEqual(3);
    expect(new Set(resources.map((item) => item.category)).size).toBeGreaterThanOrEqual(2);
  });

  it("includes an executive summary and next action for every item", () => {
    for (const item of resources) {
      expect(item.summary.length).toBeGreaterThan(80);
      expect(item.nextAction.length).toBeGreaterThan(20);
      expect(item.durationMinutes).toBeGreaterThan(0);
    }
  });

  it("resolves resources by slug", () => {
    expect(getResourceBySlug("business-that-lives-in-your-head")?.title)
      .toBe("The Business That Lives in Your Head");
  });

  it("limits featured resources to three", () => {
    expect(getFeaturedResources()).toHaveLength(3);
  });
});
```

Create `tests/seo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siteIdentity } from "../lib/seo";

describe("site identity", () => {
  it("leads with founder independence rather than AI consulting", () => {
    expect(siteIdentity.description).toContain("reduce owner dependence");
    expect(siteIdentity.description).not.toMatch(/^AI consulting/i);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```powershell
npm run test -- tests/resources.test.ts tests/seo.test.ts
```

Expected: FAIL because `lib/resources.ts` and `lib/seo.ts` do not exist.

- [ ] **Step 3: Define the content types and launch records**

In `content/resources.ts`, define:

```ts
export type ResourceCategory =
  | "run-without-you"
  | "executive-visibility"
  | "operational-friction";

export type Resource = {
  slug: string;
  title: string;
  category: ResourceCategory;
  summary: string;
  durationMinutes: number;
  format: "video" | "article" | "guide";
  youtubeId?: string;
  transcript?: string;
  nextAction: string;
  relatedCta: "scorecard" | "diagnostic";
  featured: boolean;
  publishedAt: string;
};
```

Add three launch records:

1. `business-that-lives-in-your-head`
2. `one-big-client-risk`
3. `five-pillars-of-a-sellable-business`

Use the actual published YouTube IDs if available. If a video is not yet
published, omit `youtubeId` and render the resource as a written preview rather
than inventing an ID.

- [ ] **Step 4: Implement resource selectors**

Create `lib/resources.ts`:

```ts
import { resources as sourceResources } from "../content/resources";

export const resources = sourceResources;

export function getFeaturedResources() {
  return resources.filter((item) => item.featured).slice(0, 3);
}

export function getResourceBySlug(slug: string) {
  return resources.find((item) => item.slug === slug);
}
```

- [ ] **Step 5: Implement SEO helpers**

Create `lib/seo.ts` with:

```ts
export const siteIdentity = {
  name: "Edward Abiodun",
  title: "Founder Independence & Decision Systems",
  description:
    "Helping founder-led businesses improve management visibility, document critical workflows, and reduce owner dependence through practical automation.",
} as const;

export function createPageMetadata(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: "website",
      url: path,
    },
  };
}

export function createProfessionalServiceJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: siteIdentity.name,
    url: siteUrl,
    description: siteIdentity.description,
    areaServed: "United States",
    serviceType: "Founder independence and decision systems advisory",
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
npm run test
npm run typecheck
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add content lib tests
git commit -m "feat: add typed advisory content model"
```

---

### Task 4: Build the Homepage and Core Explanatory Components

**Files:**
- Create: `components/DiagnosticSummary.tsx`
- Create: `components/OwnerDependencyMap.tsx`
- Create: `components/ResourceCard.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `getFeaturedResources()`, `Resource`, `SectionIntro`, `ScorecardCta`.
- Produces: Complete homepage, `DiagnosticSummary`, `OwnerDependencyMap`, and `ResourceCard`.

- [ ] **Step 1: Implement the owner-dependency model**

`OwnerDependencyMap` must visualize three connected dependencies:

```ts
const dependencies = [
  {
    label: "Information",
    symptom: "The owner assembles the truth manually.",
    replacement: "Reliable management visibility",
  },
  {
    label: "Decisions",
    symptom: "Routine choices wait for one person.",
    replacement: "Clear decision rights and cadence",
  },
  {
    label: "Execution",
    symptom: "Critical work depends on memory and intervention.",
    replacement: "Documented workflows and practical automation",
  },
] as const;
```

Use semantic HTML and CSS, not a model-authored SVG.

- [ ] **Step 2: Implement the diagnostic summary**

Show the exact offer facts:

- 10 business days
- $3,500 fixed pilot price
- Five workflow reviews
- Owner Dependency Scorecard
- One redesigned workflow or reporting prototype
- 90-day roadmap

The CTA label is `Review the Diagnostic`.

- [ ] **Step 3: Implement the resource card**

`ResourceCard` accepts:

```ts
type ResourceCardProps = {
  resource: Resource;
  priority?: boolean;
};
```

Show category, title, summary, format, duration, and next action. Do not load a
YouTube iframe in the card.

- [ ] **Step 4: Compose the homepage**

Use this section order:

1. Hero
2. Recognition signs
3. Owner-dependency model
4. Three operating levers
5. Diagnostic summary
6. Three featured resources
7. Credibility statement
8. Final scorecard CTA

Hero copy:

```text
Eyebrow: Founder Independence & Decision Systems
Headline: Build a business that runs on systems—not constant intervention from you.
Support: Improve management visibility, capture critical operating knowledge, and remove recurring friction with practical automation.
Primary CTA: Review the Owner Independence Diagnostic
Secondary CTA: Explore Founder Resources
```

- [ ] **Step 5: Verify responsive and keyboard behavior**

At 390px, 768px, and 1440px widths, confirm:

- No horizontal overflow
- Hero actions remain reachable
- Dependency content preserves reading order
- Focus order follows visual order
- Navigation and CTAs have visible focus states

- [ ] **Step 6: Run verification**

Run:

```powershell
npm run typecheck
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```powershell
git add app/page.tsx app/globals.css components
git commit -m "feat: build founder independence homepage"
```

---

### Task 5: Build Diagnostic, How I Help, and About Pages

**Files:**
- Create: `app/diagnostic/page.tsx`
- Create: `app/how-i-help/page.tsx`
- Create: `app/about/page.tsx`
- Modify: `content/site-copy.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Shared layout, `SectionIntro`, `DiagnosticSummary`, `ScorecardCta`, and SEO helpers.
- Produces: Three completed primary routes with unique metadata and conversion paths.

- [ ] **Step 1: Build the Diagnostic page**

Required order:

1. Fit statement
2. Problem symptoms
3. Deliverables
4. Ten-business-day process
5. Client outputs
6. Pilot price and capacity
7. Explicit non-promises
8. FAQs
9. Inquiry CTA

Include this boundary:

> This engagement does not promise complete owner independence in ten business
> days. It identifies the highest-value dependencies, produces a practical
> roadmap, and demonstrates one concrete improvement.

- [ ] **Step 2: Build the How I Help page**

Create three capability sections:

1. Executive visibility
2. Operating systems
3. Practical automation

For each, show:

- The founder-level problem
- The intervention
- The operating outcome
- A representative deliverable

Do not present these as three disconnected service packages.

- [ ] **Step 3: Build the About page**

Use a narrative structure:

1. Why better-run businesses matter
2. Cross-functional experience
3. Business outcomes before technology
4. Direct-advisor working model
5. Ethical and employment boundaries

Do not add unsupported years-of-experience figures, client logos, testimonials,
or employer-confidential examples.

- [ ] **Step 4: Add page metadata**

Use `createPageMetadata()` with:

```ts
[
  {
    path: "/diagnostic",
    title: "Owner Independence Diagnostic",
    description: "A fixed-scope 10-day diagnostic for founder-led businesses where decisions, reporting, and critical workflows still depend on the owner.",
  },
  {
    path: "/how-i-help",
    title: "How I Help",
    description: "Improve executive visibility, document decision systems, and apply practical automation to reduce owner dependence.",
  },
  {
    path: "/about",
    title: "About Edward Abiodun",
    description: "A practical advisory approach combining commercial strategy, executive reporting, operational systems, analytics, and automation.",
  },
]
```

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run typecheck
npm run test
npm run build
```

Expected: all routes build successfully.

- [ ] **Step 6: Commit**

```powershell
git add app/diagnostic app/how-i-help app/about content/site-copy.ts app/globals.css
git commit -m "feat: add core advisory pages"
```

---

### Task 6: Build Founder Resources and Video Integration

**Files:**
- Create: `components/VideoEmbed.tsx`
- Create: `app/founder-resources/page.tsx`
- Create: `app/founder-resources/[slug]/page.tsx`
- Modify: `app/globals.css`
- Modify: `content/resources.ts`
- Test: `tests/resources.test.ts`

**Interfaces:**
- Consumes: `Resource`, `resources`, `getResourceBySlug()`, `ResourceCard`, `ScorecardCta`.
- Produces: Problem-organized resource index, static detail routes, consent-based YouTube embeds, and transcript/summary content.

- [ ] **Step 1: Extend the resource tests**

Add:

```ts
it("never requires a video id for unpublished resources", () => {
  for (const item of resources) {
    if (!item.youtubeId) {
      expect(item.format).toMatch(/article|guide|video/);
      expect(item.summary).toBeTruthy();
    }
  }
});

it("does not feature more than six videos on the index", () => {
  expect(resources.filter((item) => item.youtubeId).length).toBeLessThanOrEqual(6);
});
```

- [ ] **Step 2: Implement privacy-conscious video loading**

`VideoEmbed` accepts:

```ts
type VideoEmbedProps = {
  youtubeId: string;
  title: string;
};
```

Render a poster-style consent button first. On activation, load:

```text
https://www.youtube-nocookie.com/embed/{youtubeId}?rel=0
```

The button must be keyboard-operable and the iframe must include a descriptive
`title` and `allowFullScreen`.

- [ ] **Step 3: Build the resources index**

Group resources under:

1. Build a Business That Runs Without You
2. See What Is Happening in Your Business
3. Eliminate Operational Friction

Each group has a short executive description. Do not sort the entire page as a
chronological blog feed.

- [ ] **Step 4: Build static resource detail pages**

Generate one route per resource slug. Each page contains:

- Category and duration
- Title and executive summary
- Video embed when `youtubeId` exists
- Written article or transcript
- Practical next action
- Related scorecard or diagnostic CTA
- Related resources

Return a not-found response for unknown slugs.

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test -- tests/resources.test.ts
npm run typecheck
npm run build
```

Expected: all resource routes build and tests pass.

- [ ] **Step 6: Commit**

```powershell
git add app/founder-resources components/VideoEmbed.tsx content/resources.ts tests/resources.test.ts app/globals.css
git commit -m "feat: add founder resource center"
```

---

### Task 7: Create the Scorecard, Contact Workflow, and Privacy Page

**Files:**
- Create: `public/owner-independence-scorecard.pdf`
- Create: `lib/validation.ts`
- Create: `lib/contact.ts`
- Create: `components/ContactForm.tsx`
- Create: `app/contact/page.tsx`
- Create: `app/contact/thank-you/page.tsx`
- Create: `app/api/contact/route.ts`
- Create: `app/privacy/page.tsx`
- Create: `tests/validation.test.ts`
- Create: `tests/contact.test.ts`

**Interfaces:**
- Consumes: Runtime values `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL`.
- Produces: `validateInquiry()`, `sendInquiryEmail()`, `/api/contact`, downloadable scorecard, contact UI, and privacy disclosure.

- [ ] **Step 1: Create the failing validation tests**

Create `tests/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateInquiry } from "../lib/validation";

const validInquiry = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  company: "Example Services",
  role: "Founder",
  employeeCount: "20-49",
  bottleneck: "Weekly reporting and routine approvals depend on me.",
  desiredOutcome: "Create management visibility and remove approval delays.",
};

describe("validateInquiry", () => {
  it("accepts a complete qualified inquiry", () => {
    expect(validateInquiry(validInquiry).ok).toBe(true);
  });

  it("rejects invalid email and short bottleneck descriptions", () => {
    const result = validateInquiry({
      ...validInquiry,
      email: "not-an-email",
      bottleneck: "Busy",
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implement deterministic validation**

In `lib/validation.ts`, validate:

- Name: 2–100 characters
- Email: basic RFC-compatible email pattern
- Company: 2–150 characters
- Role: 2–100 characters
- Employee count: one of `1-19`, `20-49`, `50-100`, `101-250`, `250+`
- Bottleneck: 20–2,000 characters
- Desired outcome: 20–2,000 characters
- Honeypot field `website`: must be empty

Return:

```ts
type ValidationResult =
  | { ok: true; data: Inquiry }
  | { ok: false; errors: Partial<Record<keyof Inquiry, string>> };
```

- [ ] **Step 3: Write the failing contact-service tests**

Mock `global.fetch` and verify:

1. Resend receives the configured sender and recipient.
2. User-entered content is HTML-escaped.
3. Non-2xx responses throw `InquiryDeliveryError`.
4. Missing runtime values throw `InquiryConfigurationError`.

- [ ] **Step 4: Implement Resend delivery**

`sendInquiryEmail(inquiry, env)` posts to:

```text
https://api.resend.com/emails
```

Headers:

```ts
{
  Authorization: `Bearer ${env.RESEND_API_KEY}`,
  "Content-Type": "application/json",
}
```

Subject:

```text
Owner Independence Diagnostic inquiry — {company}
```

Never log the API key or the full inquiry payload.

- [ ] **Step 5: Implement the API route**

`POST /api/contact` must:

1. Reject bodies larger than 16 KB.
2. Parse JSON safely.
3. Validate the inquiry.
4. Return `422` with field errors for invalid input.
5. Return `429` for repeated automated submissions when the honeypot is filled.
6. Send the inquiry email.
7. Return `{ ok: true }` on delivery.
8. Return a generic `503` message on delivery failure without exposing internals.

- [ ] **Step 6: Build the contact page**

Required fields:

- Name
- Work email
- Company
- Role
- Employee count
- Primary operational dependency
- Desired outcome

Show:

- Inline field errors
- Submitting state
- Confirmed success state
- Recoverable failure state
- What happens after submission
- A two-business-day response expectation

After a successful API response, preserve the visible confirmation state and
update the route to `/contact/thank-you`. The thank-you route is excluded from
the primary navigation and gives production analytics a stable conversion URL.

- [ ] **Step 7: Create the scorecard PDF**

Create a polished, accessible PDF titled:

> The Owner Independence Scorecard  
> 15 questions to test whether your business can run without you

Use five dimensions with three questions each:

1. Decision dependence
2. Information and reporting dependence
3. Process dependence
4. Customer relationship dependence
5. Leadership and accountability dependence

Include a scoring guide, interpretation, three immediate actions, and a final
Diagnostic CTA. Render and visually inspect every page before adding the PDF to
`public/`.

- [ ] **Step 8: Create the privacy page**

Disclose:

- Data collected through the inquiry form
- Purpose of collection
- Resend as the delivery processor
- YouTube privacy-enhanced embeds
- Analytics only if actually enabled
- Retention and deletion contact process
- No sale of personal data

Do not claim legal compliance beyond what has been implemented and reviewed.

- [ ] **Step 9: Run tests and build**

Run:

```powershell
npm run test -- tests/validation.test.ts tests/contact.test.ts
npm run typecheck
npm run build
```

Expected: all tests and the production build pass.

- [ ] **Step 10: Commit**

```powershell
git add app/contact app/api/contact app/privacy components/ContactForm.tsx lib public/owner-independence-scorecard.pdf tests
git commit -m "feat: add diagnostic inquiry workflow"
```

---

### Task 8: Add Discoverability, Social Preview, and Final Quality Gates

**Files:**
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Create: `public/og.png`
- Create: `public/favicon.svg`
- Modify: `app/layout.tsx`
- Modify: `lib/seo.ts`
- Modify: `app/globals.css`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Consumes: Final brand direction, all public routes, `createProfessionalServiceJsonLd()`.
- Produces: Sitemap, robots directives, structured data, social preview, favicon, and final verified build.

- [ ] **Step 1: Add sitemap and robots output**

The sitemap includes:

- `/`
- `/diagnostic`
- `/how-i-help`
- `/founder-resources`
- Every published resource detail route
- `/about`
- `/contact`
- `/privacy`

Robots output allows public content and points to the absolute sitemap URL.

- [ ] **Step 2: Add structured data**

Embed:

- `Person` on the About page
- `ProfessionalService` on the Home and Diagnostic pages
- `Article` for written resources
- `VideoObject` for published videos with real YouTube IDs

Do not invent publication dates, thumbnails, client ratings, or review data.

- [ ] **Step 3: Generate one bespoke social card**

Create one landscape `public/og.png` using the approved palette and typography.
Required visible text:

```text
Build a business that runs on systems.
Founder Independence & Decision Systems
Edward Abiodun
```

Inspect the generated image. Retry once only if text is incorrect or illegible.
If both attempts fail, omit `og:image` rather than ship a generic image.

- [ ] **Step 4: Add final SEO tests**

Test that:

- Every primary page has a unique title and description.
- The sitemap contains all six primary pages.
- Published video resources include valid 11-character YouTube IDs.
- Structured data contains no empty required values.

- [ ] **Step 5: Run automated quality checks**

Run:

```powershell
npm run test
npm run typecheck
npm run build
```

Expected: all commands pass with no unresolved warnings that affect delivery.

- [ ] **Step 6: Perform explicit browser QA**

Because browser QA is part of this approved plan, test:

- 390×844 mobile
- 768×1024 tablet
- 1440×900 desktop

Check every route for:

- Navigation and active state
- Keyboard-only operation
- Visible focus
- Heading hierarchy
- Color contrast
- Text resizing to 200%
- No horizontal overflow
- Contact validation, success, and failure states
- Video consent and iframe loading
- PDF download
- Internal and external links
- Reduced-motion preference

Fix all material issues and rerun the production build.

- [ ] **Step 7: Commit**

```powershell
git add app lib public tests
git commit -m "feat: complete website discovery and quality gates"
```

---

### Task 9: Configure Runtime Values and Publish Privately

**Files:**
- Modify: `.openai/hosting.json` only through confirmed Sites project metadata.
- Create: `docs/launch-measurement.md`
- Verify: `.env.example`
- Verify: production build output

**Interfaces:**
- Consumes: Successful build, verified Resend sender domain, inquiry recipient, and Sites source state.
- Produces: Private production deployment URL and functioning inquiry delivery.

- [ ] **Step 1: Confirm required runtime values**

Obtain and configure:

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

The sender must use a domain verified in Resend. Do not place any secret in
source control or `.openai/hosting.json`.

- [ ] **Step 2: Create the Sites project once**

Create one Sites project and persist only its returned `project_id` in
`.openai/hosting.json`. Never call project creation twice for the same site.

- [ ] **Step 3: Build the exact deployment source**

Run:

```powershell
npm run build
```

Expected: successful Cloudflare Worker-compatible output.

- [ ] **Step 4: Verify production inquiry delivery**

Submit one clearly labeled internal test inquiry:

```text
Company: Deployment Verification — Do Not Treat as Lead
Bottleneck: This is a controlled verification of the production inquiry delivery path.
Desired outcome: Confirm that the website can deliver validated inquiries successfully.
```

Confirm that the recipient receives the message and that no secret appears in
logs or rendered output.

- [ ] **Step 5: Create the 90-day commercial validation scorecard**

Create `docs/launch-measurement.md` with this table:

```md
# 90-Day Website Validation Scorecard

| Measure | 90-day target | Evidence source | Review cadence |
|---|---:|---|---|
| Qualified non-KION founder conversations | 10+ | Conversation log | Weekly |
| Owner Independence Diagnostic inquiries | Track baseline | `/contact/thank-you` production visits plus received inquiries | Weekly |
| Scorecard interest | Track baseline | Scorecard resource-page and PDF-download traffic | Weekly |
| Pilot clients | Up to 3 | Signed pilot engagements | Monthly |
| Inquiry-to-conversation conversion | Track baseline | Inquiries divided by completed conversations | Monthly |
| Conversation-to-pilot conversion | Track baseline | Pilot clients divided by completed conversations | Monthly |
| Best-performing topic | Identify top 3 | Resource visits, LinkedIn referrals, and conversation mentions | Monthly |
```

Record how Sites exposes page traffic and referral data. Use
`/contact/thank-you` as the inquiry conversion URL and the scorecard resource
page as the scorecard-interest URL. Do not install an additional analytics
vendor unless the built-in production analytics cannot provide page and
referral counts.

- [ ] **Step 6: Save and deploy the validated version**

Push the exact validated source, package the site with the Sites helper, save
one version using the pushed commit SHA, and deploy it privately.

- [ ] **Step 7: Poll deployment status**

Continue until deployment reports `succeeded` or a terminal failure. Do not
report completion from a non-terminal status.

- [ ] **Step 8: Open and hand off**

Open the exact private deployment URL in Codex and provide the URL to the user
with a concise description of:

- The six-page website
- The Owner Independence Diagnostic conversion path
- The founder resource center
- The scorecard
- The verified inquiry form

- [ ] **Step 9: Final commit**

```powershell
git add .openai/hosting.json docs/launch-measurement.md
git commit -m "chore: record private site deployment"
```

---

## Final Verification Checklist

- [ ] All six primary pages are present and linked in the main navigation.
- [ ] Home leads with owner independence rather than AI consulting.
- [ ] Diagnostic shows the exact 10-day, $3,500, three-pilot offer.
- [ ] No page promises complete owner independence in 10 days.
- [ ] How I Help connects visibility, systems, and automation to one outcome.
- [ ] Founder Resources contains at least three launch resources across at least two categories.
- [ ] No more than six YouTube players are embedded on the resource index.
- [ ] Every video includes summary, duration, next action, and conversion path.
- [ ] About contains only supportable claims and the conflict boundary.
- [ ] Contact validation, success, and failure states work.
- [ ] Scorecard PDF has passed render-and-inspect QA.
- [ ] Metadata, sitemap, robots, and structured data use real values.
- [ ] Responsive, keyboard, focus, contrast, and 200% zoom checks pass.
- [ ] `npm run test`, `npm run typecheck`, and `npm run build` pass.
- [ ] Production inquiry delivery is verified.
- [ ] Private Sites deployment reports `succeeded`.
- [ ] The 60–90 day validation scorecard targets at least 10 qualified non-KION founder conversations and up to three pilot clients.
