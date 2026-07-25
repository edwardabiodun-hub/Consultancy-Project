# About Eddie Page Design

## Purpose

Replace the existing generic About page with a human, evidence-based introduction to Edward "Eddie" Abiodun. The page should help founders and CEOs understand who Eddie is, why his experience is relevant, and what it would feel like to work with him.

The page is not a résumé. Its single job is to convert professional credibility into enough trust for a qualified visitor to start a focused conversation.

## Source of Truth

Primary source:

- `Edward Abiodun _ LinkedIn.pdf`

Secondary sources:

- The current website positioning and approved buyer-problem-offer architecture
- The existing consulting-boundary language
- Public LinkedIn recommendations visible on Eddie's profile

Do not invent employers, dates, credentials, performance figures, or client outcomes. Paraphrase recommendation excerpts conservatively and attribute them by name and professional relationship.

## Content Architecture

### 1. Human-led hero

- Eyebrow: `About Eddie`
- Headline: `Clearer decisions. Stronger operating systems. Less dependence on one person.`
- Supporting copy: Eddie helps leaders turn fragmented information, unclear accountability, and founder dependency into practical management systems.
- Display the current LinkedIn headshot extracted from the supplied PDF.
- Include a direct LinkedIn profile link.
- Primary action: `Start a focused conversation`
- Secondary action: `See the diagnostic`

### 2. Personal biography

Write in the first person and keep it concise.

Required points:

- Commercial planning and market-intelligence leadership
- Experience connecting demand planning, forecasting, SIOP, competitive intelligence, executive reporting, and commercial strategy
- A consistent focus on turning complex or fragmented data into clear decisions
- Charleston, South Carolina as Eddie's professional base
- The belief that technology should support a defined decision or workflow rather than lead the engagement

### 3. What Eddie brings

Use three evidence-oriented capability groups rather than a generic skills grid:

1. `Commercial clarity`
   - Demand planning
   - Forecasting and SIOP
   - Market and competitive intelligence

2. `Executive visibility`
   - KPI frameworks
   - Executive reporting
   - Decision-ready synthesis

3. `Scalable execution`
   - Process design
   - Automation
   - AI-enabled decision systems

Each group must explain the management outcome, not merely list tools.

### 4. Operating philosophy

Use the site's Decision Margin signature to present two principles:

- `What changes:` Leaders receive a clearer operating picture, ownership structure, and decision cadence.
- `What remains:` Judgment, accountability, and final decisions remain with the leadership team.

State Eddie's working sequence:

1. Begin with the business decision or operating constraint.
2. Identify the missing information, ownership, or workflow.
3. Design the lightest system that improves the decision.
4. Introduce automation or AI only where it removes recurring friction.

### 5. Professional proof

Include two short recommendation excerpts:

- Christoph Brand: emphasize Eddie's reliability, analytical skill, professionalism, ability to distill complex data, and support for sales strategy.
- Christian Bischof: emphasize analytical rigor in market forecasting, competitor analysis, order-intake planning, strategic initiatives, and reporting improvements.

Use no more than 35 paraphrased words per recommendation. Link the section to Eddie's LinkedIn profile for full context.

### 6. Professional boundaries

Retain and refine the existing disclosure:

- Independent advisory work does not use confidential employer information.
- Eddie does not accept engagements involving KION dealers, direct competitor dealer networks, or material-handling pricing, competitive strategy, or intelligence work that overlaps with employment responsibilities.

Present this as a concise trust signal, not a legal disclaimer.

### 7. Closing invitation

Headline: `If the business has outgrown informal coordination, start there.`

Explain that the first conversation is used to determine whether the Owner Independence Diagnostic is appropriate.

Primary action: `Start a focused conversation`

## Visual Direction

Preserve the existing Quiet Authority system:

- Canvas: `#F5F4EF`
- Paper: `#FBFAF6`
- Ink: `#18231E`
- Forest: `#173F32`
- Bronze: `#9A693A`
- Display type: Georgia
- Body and utility type: Segoe UI

### Portrait treatment

- Extract the supplied LinkedIn headshot rather than recreating or retouching Eddie's appearance.
- Use the photograph at a constrained size to avoid exposing its limited source resolution.
- Present it in a rectangular editorial crop with a quiet paper frame.
- Let the portrait edge intersect the bronze Decision Margin in the hero. This is the page's single visual signature.
- Include meaningful alternative text: `Edward Abiodun`.

Do not use generic office, warehouse, AI, or stock photography.

## Responsive Behavior

- Desktop: portrait and introduction form an asymmetric two-column hero.
- Tablet: maintain two columns while reducing portrait width.
- Mobile: portrait appears above the headline and actions; all capability and recommendation content becomes single-column.
- Avoid horizontal overflow at 390, 768, and 1440 pixels.
- Preserve visible keyboard focus and reduced-motion behavior.

## Implementation Boundaries

- Replace `/about`; do not add a second biography route.
- Reuse existing shared header, footer, buttons, containers, and Decision Margin component where appropriate.
- Add only page-specific styles needed for the portrait, biography, proof, and capability sections.
- Do not add a CMS, animation library, testimonial carousel, timeline component, or new dependency.
- Do not change the broader buyer-problem-offer architecture.

## Validation

- Verify the page renders the approved headline and biography.
- Verify the portrait asset loads and has correct alternative text.
- Verify both recommendation attributions and the LinkedIn link.
- Verify the professional-boundaries language is present.
- Build and lint successfully.
- Check the page at 390, 768, and 1440 pixels with no horizontal overflow.
- Confirm the production deployment succeeds before reporting completion.

