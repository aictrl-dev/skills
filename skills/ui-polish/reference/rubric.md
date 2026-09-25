# Polish rubric

Judge each point from the screenshots at phone and desktop width, using the measurements as evidence. For every point that fails, name the element and the fix. Skip points that do not apply to the screen.

## 1. Grid and alignment
- Repeated elements (fields, cards, rows) share edges and column lines.
- One left edge for the content column; labels, fields, helper text and buttons start on it.
- Paired inputs (feet and inches, stones and pounds, first and last name) sit in equal columns.

## 2. Sizing
- Fields are sized to the column, not to the expected value; on phones they fill the column.
- The primary action is full width on phones and clearly the largest control.
- Nothing is so small it looks disabled or decorative.

## 3. Labels and units
- Every field has a visible label above it; units are part of the label or a suffix inside the field.
- Examples, when useful, are in the placeholder or helper text, never instead of the label.
- Mode switches (units, formats) are one visible control before the fields, showing the current state, not a link under each field.

## 4. Hierarchy and focal point
- One clear heading states the question or the job of the screen.
- Supporting copy is one short paragraph under it, only if it helps the person answer (for example, why the question is asked).
- The eye goes heading → fields → primary action with nothing competing.

## 5. Grouping and rhythm
- Related fields are grouped, with more space between groups than within them.
- Spacing uses a consistent scale (multiples of 4 or 8px); no empty bands mid-flow.
- The primary action follows the last field.

## 6. Type
- Two or three sizes on a form screen: heading, body and label, small helper.
- Body and field text at least 16px on phones; helper text at least 14px.
- Weight, not size alone, separates labels from values.

## 7. Colour and contrast
- Text meets WCAG AA; links and hints do not fade into the background.
- One accent colour for action; status colours only for status.
- Surfaces separate the task from the page chrome (a card or a clear background change) when the page is busy.

## 8. Controls and states
- Every control shows hover, focus, pressed, disabled and error states that are visibly different.
- Errors appear next to the field, say what is wrong and how to fix it.
- Progress in a multi-step flow shows where you are in words, not only a bar.

## 9. Consistency
- The same control looks the same everywhere on the screen (all fields, all buttons, all toggles).
- Corner radius, border weight and shadow follow one system.

## 10. Trust at the point of the task
Give each sub-check its own verdict; the point passes only when all that apply pass.
- **10a Where you are:** the step or question is named in words near the task, not only a bar.
- **10b How much is left:** remaining steps or time are shown, or a bracketed placeholder is added for the owner to fill.
- **10c Whose service:** the brand or service is visible in or next to the task area, not only in a distant header.
- **10d Why we ask:** a sensitive question (health, money, identity, contact details) says why it is asked and how the answer is used, in approved words or a bracketed placeholder. A screen that asks for health data with no reason fails this.
- **10e Finished:** no stray elements, clipped text or leftover debug content.
