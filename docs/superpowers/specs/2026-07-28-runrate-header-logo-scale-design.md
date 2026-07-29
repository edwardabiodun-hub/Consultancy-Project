# RunRate Header Logo Scale Design

## Objective

Increase the visual authority of the RunRate Advisory header lockup so it reads as a primary brand asset rather than a utility mark.

## Approved Design

- Increase the logo icon from 56px to 76px on desktop.
- Increase the `RUNRATE` wordmark from 24px to 30px.
- Increase the `ADVISORY` descriptor from 10px to 12px.
- Increase the header minimum height from 94px to 116px.
- Preserve a single-row desktop header by tightening navigation spacing where necessary.
- Scale the lockup down proportionately below 900px so navigation remains usable.
- Preserve the existing SVG, colors, typography, accessible home label, and navigation content.

## Responsive Behavior

Desktop uses the full 76px lockup. Tablet and mobile use a 64px icon, 26px wordmark, and 11px descriptor. Navigation may wrap at the existing tablet breakpoint and remains left-aligned below 620px.

## Verification

Rendered HTML must contain intrinsic logo dimensions of 76 by 76 pixels. The production build and existing browser accessibility suite must pass, including the mobile horizontal-overflow check.

