# Funnel Preflight

This vault folder holds **completed** Funnel Preflight Briefs — the decisions you lock **before** building ClickFunnels pages, VSLs, ads, LinkedIn/YouTube promo, or quiz funnels.

## Why this exists

The usual failure mode is cart-before-horse: designing opt-in pages and VSLs before the product, price, upsells, and brand colors are decided. Preflight fixes that.

## How to run it in Cursor

1. Open Agent chat and say something like: **"Run Funnel Preflight for [offer]"** or **"I want to build a funnel for [book/program] — start preflight."**
2. Cursor loads the skill at `.cursor/skills/funnel-preflight/`.
3. Answer gates in order. Build work stays **blocked** until Product & Offer and Economics are locked.
4. The agent saves a brief here: `YYYY-MM-DD - Offer Name - Preflight Brief.md`

You can also invoke explicitly with `/funnel-preflight` if your Cursor version lists project skills that way.

## What gets decided

| Gate | Decisions |
|------|-----------|
| A | Product type (book, digital book, live/online program…), title, delivery |
| B | Price, bump, upsell, downsell, guarantee |
| C | Avatar, promise, mechanism, proof |
| D | **Wedge vs Bignition** (or other) brand colors |
| E | Click campaigns, LinkedIn/YouTube CTAs, quiz vs other lead magnet |
| F | Full path map + asset list |

## After the brief is locked

Copy and pages follow **Jon Benson (BNSN)** structure for VSL and much of the email. Strategy spine follows **Joe Polish / Dean Jackson** offer-and-before-unit thinking. See:

- `.cursor/skills/funnel-preflight/references/marketer-frameworks.md`
- `.cursor/skills/funnel-preflight/references/funnel-architecture.md`

## Templates

- Cursor asset template: `.cursor/skills/funnel-preflight/assets/preflight-brief-template.md`
- Obsidian copy: [[_templates/preflight-brief]]
