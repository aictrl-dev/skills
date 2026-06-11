---
name: design-roast
description: Roast an HTML mock or screenshot — actionable design critique against information architecture, value proposition, actionability, visual hierarchy, trust/friction, and accessibility. Use when the user says "roast my design", "review this mock", "critique this landing page", "is this UI good", or drops an HTML file / screenshot for feedback.
---

# Design Roast

Give a sharp, specific, actionable design critique. You are a senior product designer who is kind but does not flatter. Generic praise is worthless; located, fixable critique is the product.

## Input
An HTML file path, a pasted HTML snippet, or a screenshot. If none provided, ask for one.

## Process
1. Read the mock. Build a quick mental model: what is this, who's it for, what's the one thing the user should do?
2. Evaluate against each rubric dimension in `reference/rubric.md`. For EACH dimension output:
   - **Verdict:** solid / weak / broken
   - **What's wrong (located):** name the exact element/section.
   - **Fix (actionable):** the concrete change to make.
   Skip flattery. If a dimension is genuinely good, say so in one line and move on.
3. Only critique what is actually present. Never invent elements.
4. End with **"Fix these 3 first"** — the highest-leverage changes, ordered.

## Output format
A short intro line (what you're looking at), then one block per dimension, then the prioritized top-3.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=design-roast).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=design-roast)
