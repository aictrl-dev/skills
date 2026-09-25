# Design Review Rubric

**First, classify the surface** — it sets which lens dominates:
- **Marketing surface** (landing / pricing / home): the job is *convince a stranger*. Universal dimensions + the **Marketing lens**.
- **Product internal** (dashboard, table/list, detail view, settings, a step in a flow): the job is *let a user get work done*. Universal dimensions + the **Product-internal lens**.
- **Mixed / unsure:** use the universal dimensions and apply whichever lens fits.

**Then check the scope:** if the input covers **more than one screen** (a clickable prototype, several screenshots, a set of pages, a flow), also apply the **Cross-screen lens** at the end. Most information-architecture problems only show up across screens.

For every dimension you assess: a one-word **Verdict** (`solid` / `weak` / `broken`), then — only if not solid — the **located** problem and the **actionable** fix. Never invent elements.

---

## Universal dimensions (any UI)

### U1. Orientation & purpose (5-second test)
Within 5 seconds, is it clear **what this is**, **what state I'm in**, and **what it's for**?
- *Marketing:* benefit-led headline naming the user + outcome ("Ship X 2× faster, for Y teams"). **Broken:** a mood-line a competitor could paste their name on.
- *Product:* screen purpose + my location are obvious (title, breadcrumb, selected nav, current state). **Broken:** I land and can't tell what I'm looking at or where I am.

### U2. Information architecture
Is content ordered/grouped by **user priority**, and can the primary thing be found fast?
- *Marketing:* one clear top-to-bottom path; most important thing first and biggest.
- *Product:* the data + controls for the screen's main task are grouped and findable, not scattered.

### U3. Primary task / actionability
Is the **one main action or path** obvious and unobstructed?
- *Marketing:* a single primary CTA; secondaries de-emphasized. **Broken:** multiple equal-weight CTAs ("choose how to choose").
- *Product:* the screen's primary task (create / filter / resolve / save) is the most prominent reachable affordance. **Broken:** it's buried among equally-weighted controls or hidden in a menu.

### U4. Visual hierarchy
Do **size / contrast / spacing** guide the eye to the right thing first? One focal point; primary > secondary > tertiary. **Broken:** competing equal-weight elements, or low-contrast text that recedes.

### U5. Serves the user's job
Does the content/flow actually help the user act?
- *Marketing:* copy is **benefit-led** (outcomes), not **feature-led** (tech specs — "Built with Rust" is not a benefit).
- *Product:* exposes what the user needs to decide/act, at the right detail — nothing required missing, no irrelevant noise dominating.

### U6. Friction & cognitive load
How much effort to get the value?
- *Marketing:* trust signals present (proof, logos, numbers); forms short; plain language.
- *Product:* minimal steps/clicks for the main task; sensible defaults; not overwhelming; jargon-free labels.

### U7. Craft & accessibility (folds into the most relevant dimension)
- Contrast: body text ≥ WCAG AA 4.5:1 (`#aaa` on white ≈ 2.3:1 — fails; use ≥ `#595959`).
- Click/tap targets ≥ 44×44px; body type ≥ 16px; visible focus states; responsive sanity (does a flex row wrap on mobile?).

---

## Marketing-surface lens (landing / pricing / home)
Emphasize: **value-prop sharpness** (the "could a competitor paste their name on this?" test); a **single dominant CTA**; **credibility / social proof** (logos, metrics, testimonials); **benefit-vs-feature** copy; **form friction** (every field is a drop-off — usually cut to email).

## Product-internal lens (an app screen people work in)
Add these dimensions on top of the universal ones:

### P1. Information density & scannability
Is data legible and grouped, or a wall / too sparse? Tables & lists: column priority, alignment, truncation, row spacing. **Broken:** can't scan a row, or empty acres of space around a single control.

### P2. Feedback & states
Are **loading / empty / error / success** states designed? Do controls show **hover / active / disabled / focus**? **Broken:** dead clicks, no empty state, errors with no guidance.

### P3. Navigation & wayfinding
Can the user tell **where they are** and get **back / around**? Consistent nav, breadcrumbs, clear back paths, current-location indicator. **Broken:** dead ends, no indication of the active section.

### P4. Consistency
Repeated patterns, a spacing scale, and reused components — no one-offs. **Broken:** three button styles, three spacings, inconsistent icons/labels for the same concept.

### P5. Error prevention & recovery
Destructive actions confirmed; inputs constrained (selects vs free text); undo where possible; mistakes recoverable. **Broken:** a one-click irreversible delete, or free-text where a constrained value belongs.

### P6. Data legibility (data-heavy screens)
Numbers right-aligned, units clear, charts labeled, no chartjunk, the **key metric is the most prominent**. **Broken:** unlabeled axes, a dashboard where everything is the same size so nothing matters.

---

## Cross-screen lens (a prototype, a flow, or several screens)
Single-screen review misses the most common product-level problems: the same concept under several names, the same job in several places. Before judging, build a **concept inventory**: for every object (issue, run, order…), state (draft, ready, failed…) and action (start, approve, plan…) the UI shows, list each **label** it appears under and each **screen or place** it appears on. Put the inventory in the output as a table: *concept → labels used → places*.

### X1. One name per concept
Each concept uses one label everywhere, and each label means one thing. **Broken:** synonyms (the same state shown as "Draft", "Needs refining" and "2 things missing" on different screens), or homonyms ("Plan" used for a stage, a tab and a mode). **Fix:** pick the user's word, name it once, list every place to rename.

### X2. One place per job
Each user job ("what needs me?", "why can't this start?", "start work") has one home, and other screens link to it rather than repeat it. **Broken:** the same list or count rebuilt in several places with different rules; a whole page that duplicates another page filtered differently; orphans (a concept with no clear home). **Fix:** name the home for each job and what to remove or turn into a link.

### X3. One vocabulary for state and action
Status labels, list groups, board columns and progress indicators use the same set of states; the same action uses the same verb on every surface. **Broken:** four parallel ways to say where an item is; six verbs for starting the same action. **Fix:** one state set and one verb per action, mapped from the current labels.

### X4. Density budget
Count, for each main screen: visible controls, words, and badges or pills. Report the numbers so "simpler" can be measured and compared after changes. **Weak:** a list row carrying several badges, or a screen whose controls outnumber the decisions it supports. **Fix:** the specific elements to merge, move behind disclosure, or remove, with the expected new counts.

