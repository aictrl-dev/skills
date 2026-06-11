# Design Review Rubric

Six **verdict dimensions** (1-6) plus one **craft pass** (7) that folds its findings into
whichever verdict dimension it touches (usually #4 visual hierarchy or #6 trust & friction).

For every dimension give a one-word **Verdict** (`solid` / `weak` / `broken`), then — only if
not solid — the **located** problem and the **actionable** fix. Never invent elements.

---

## 1. Value proposition (5-second test)
Within 5 seconds, is it clear **WHAT** this is and **WHO** it's for?
- **Good:** benefit-led headline that names the user and the outcome ("Ship X 2× faster, for Y teams").
- **Broken:** a vague slogan or brand mood-line ("Reimagine the future of work") that could belong
  to any company. A logo + tagline that survives the "could a competitor paste their name on this?" test is a fail.
- **Locate:** the `<h1>` and the sub-headline. **Fix:** rewrite as `who` + `outcome` + `how`.

## 2. Information architecture
Is content ordered by **user priority**? Can the primary info/action be found in <5s?
- **Good:** one clear top-to-bottom path; the most important thing is first and biggest.
- **Weak:** secondary content (long forms, feature lists, footer-grade detail) crowding the hero.
- **Locate:** the section order. **Fix:** state which block should move up/down or off the first screen.

## 3. Primary action / actionability
Is there **ONE** obvious next step, above the fold, visually dominant?
- **Good:** a single primary CTA; any secondary action is visibly de-emphasized (ghost/text link).
- **Broken:** multiple CTAs of equal visual weight — the user has to *choose how to choose*.
- **Locate:** count the buttons and compare their styling. **Fix:** pick the one primary action,
  demote the rest to ghost buttons or text links.

## 4. Visual hierarchy
Do **size / contrast / spacing** guide the eye to the right thing first?
- **Good:** one focal point per screen; clear primary > secondary > tertiary.
- **Broken:** competing equal-weight elements; nothing wins; or low-contrast text that recedes.
- **Locate:** name the competing elements (e.g. "three identical filled buttons"). **Fix:** the
  concrete weight change (color, size, fill vs outline, whitespace).

## 5. Solves the user's problem
Is the copy **benefit-led** (outcomes, jobs-to-be-done) or **feature-led** (tech specs)?
- **Good:** "Close the books in a day", "Onboard a hire without IT tickets" — outcomes the user feels.
- **Broken:** "Built with GraphQL", "Written in Rust", "Powered by Kubernetes" — implementation
  details the buyer does not care about. Tech stack is not a benefit.
- **Locate:** quote the offending bullets/lines. **Fix:** rewrite each as the outcome it enables.

## 6. Trust & friction
Are there **credibility signals** (proof, specifics, logos, numbers) and is the path **low-friction**?
- **Good:** social proof, concrete numbers, short forms, plain language, low cognitive load.
- **Broken:** long forms above the fold (each field is a drop-off), jargon, no proof of any kind.
- **Locate:** count the form fields and name missing proof. **Fix:** cut the form to the minimum
  (usually just email) and name the specific trust element to add (logos, a metric, a testimonial).

## 7. Craft & accessibility (folds into 4 or 6)
- **Contrast:** body text should meet WCAG AA ≥ 4.5:1. Flag low-contrast greys (e.g. `#aaa` on white
  is ≈ 2.3:1 — fails). **Fix:** name a darker value (≥ `#595959` on white passes AA).
- **Tap targets:** interactive elements ≥ 44×44px.
- **Type:** body ≥ 16px; flag sub-16px paragraph text.
- **Responsive sanity:** does a horizontal flex row of buttons/features wrap on mobile?
