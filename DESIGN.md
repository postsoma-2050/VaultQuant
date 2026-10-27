# VaultQuant Interface Contract

VaultQuant is a desktop trading journal. The interface should help someone find a trade, check a figure, and write a review without learning decorative terminology.

## References

Use the restrained hierarchy and low-decoration surfaces from [Linear's design analysis](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md) and the readable financial information hierarchy from [Mercury's design analysis](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/mercury/DESIGN.md). These files describe brand websites; adapt their principles to a desktop application rather than copying their marketing layouts or claiming certification.

## Visual Rules

- White content surfaces on a Zinc-50 workspace; Zinc-200 borders. One neutral palette rather than mixing warm brown, blue-grey, and Zinc.
- Local bundled sans for reading and UI; monospace/tabular numerals for amounts, dates, quantities. Body 13-14px, supporting text at least 12px where practical, page title 24px/600. Avoid uppercase monospace labels throughout the interface.
- Reserve emerald-700 and rose-700 for readable profit/loss text. Use amber for warnings. Add a written status, not color alone.
- Default radius 6-8px. Borders establish groups; shadows belong to overlays. Do not place every figure in a separate card or wrap every label in a pill.
- Use direct labels: Reports, Positions, Observation, Unrealized P&L. Avoid repeated claims about professional terminals, audit intelligence, engines, or local database implementation details in normal user flows.
- Use standard line icons with accessible names. No decorative sparkle icons, emoji, pulsing status dots, simulated testimonials, or artificial typewriter delays.

## Desktop Window Behavior

Support wide monitors AND resized desktop windows. Review at 1000x700, 1024x768, 1280x720, 1440x900, and 1920x1080, plus enlarged browser text/125% zoom. This is desktop adaptation, not a mobile layout project.

- The shell has a bounded viewport height. Main content has `min-width: 0`, `min-height: 0`, and an actual scroll owner. The sidebar scrolls independently when the window is short.
- Content-driven pages grow naturally; flex children must not shrink tables until rows become inaccessible.
- Data tables have explicit column minimum widths. If they do not fit, provide a local horizontal scroller and visible navigation affordance. Never squeeze P&L, status, and actions into fractional columns that overlap.
- Allow full observations to wrap. Keep amounts, dates, and action controls on a stable baseline.
- Editors keep a usable writing width; supporting panels may be hidden with an explicit toggle.
- Dialogs and drawers must keep their last field and action reachable at short window heights. Escape closes overlays; returning must restore a usable workspace.

## Interaction and Data Rules

- Loading, empty results, and failures are distinct states with relevant actions.
- Never interpret a missing quote, unavailable snapshot, or missing risk assessment as zero or passed.
- Every filter and range selector must have a clear scope and visibly affect the data it labels.
- Confirm destructive actions. Keep the dialog open when a mutation fails and guard duplicate submissions.
- Only update saved/favorite states after the server confirms success.
- Protect journal changes when navigating and when saving while typing. Each date must load its own content.
- Existing calendar days open their review; blank days can open an add form. Journal navigation must not also trigger the day drawer.
- Keep real financial calculations intact; changes to ledger/return definitions need separate evidence and tests.

## Verification

A successful build or HTTP 200 is not UI acceptance. Verify wheel/keyboard scrolling, narrow-window column separation, filtering, view switches, overlay cancellation, and last-row/last-control reachability in a real browser. Record screenshot paths and exact sizes in the acceptance report. Do not describe specification goals as implemented features until checked.
