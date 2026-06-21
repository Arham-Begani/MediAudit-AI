# Turning a synthetic bill into a photo (for the vision pass)

MediAudit's first pass reads a **photo or PDF** of a bill. To test that end-to-end you
need realistic *images*, not just text. Use Google's image model to render any of the
`.txt` bills in this folder as a photographed statement.

- **Model:** `gemini-2.5-flash-image` (a.k.a. "Nano Banana") in
  [Google AI Studio](https://aistudio.google.com) → *Create > Image*, or via the
  `@google/genai` SDK with the same key the app already uses.
- **Workflow:** open a bill `.txt`, copy its full text, paste it into the `{{BILL_TEXT}}`
  slot in the prompt below, run it, download the PNG, then upload that PNG in the app.

---

## The prompt (paste a bill's text into `{{BILL_TEXT}}`)

```
Generate a photorealistic image of a printed hospital itemized billing statement,
as if a stressed patient quickly photographed it on a kitchen table with a phone.

CONTENT — reproduce this text EXACTLY as the printed content of the statement,
preserving the line items, codes, descriptions, and dollar amounts. Lay it out as a
real medical bill: facility name and address as a header, a patient/account info block,
a columnar table with LINE / CODE / DESCRIPTION / CHARGE headings, and a total at the
bottom. Use a clean monospaced or sans-serif billing font and faint table gridlines.

{{BILL_TEXT}}

STYLE — make it look like a genuine document photo, not a clean screenshot:
- white or pale-gray paper with a subtle paper texture
- slight perspective skew and one gently curled or creased corner
- soft, uneven indoor lighting with a faint shadow across one edge
- a hospital-style logo mark or letterhead block (generic, no real brand)
- realistic but slightly imperfect print alignment
Keep ALL text crisp and legible — a billing clerk should be able to read every line.
Single page. Do not add, remove, or alter any line item, code, or amount.
```

---

## Useful variations

Append one of these to the prompt to stress-test the OCR robustness:

- **Harder read:** `Make it a slightly lower-quality photo — mild motion blur on the top
  edge, a soft coffee-cup ring stain in one corner, and a visible staple hole. Text must
  still be readable.`
- **Scanned look instead of photo:** `Render it as a flatbed-scanner output: perfectly
  flat, high contrast, faint scanner banding, no perspective skew.`
- **Multi-page bills (`01`, `03`, `05`, `07`):** generate each page separately — split the
  text at the `(PAGE 2 OF 2)` marker and run the prompt once per page, so you can test the
  multi-image upload path.
- **Crumpled / folded:** `The paper looks like it was folded into thirds to fit an
  envelope, with two horizontal fold creases.`

## Testing the privacy guardrail

To prove the vision pass **masks identifiers**, before generating, replace the four
`[MASKED]` values in the bill text with one of the **synthetic** identities listed in
[`README.md`](./README.md) (e.g. patient `JORDAN A. RIVERA`, DOB `04/18/1987`). Generate
the image, upload it, and confirm the extracted transcript comes back with those values
scrubbed. Never use a real person's details for this — the synthetic identities exist
precisely so you don't have to.

> Tip for the pitch video: the "before" frame (a messy phone photo of a bill) → "after"
> frame (a clean, decoded, plain-English dossier) is your single most persuasive 10
> seconds. Generate one good hero image and build the walkthrough around it.
