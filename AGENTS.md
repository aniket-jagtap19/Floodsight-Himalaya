<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## FloodSight Himalaya — Permanent Rules

The following rules apply to every agent, tool, and contributor working in this repository.

### 1. Validation-only data sources

Never use Copernicus EMS (EMSR activations), UNOSAT products, published damage maps, or post-event OpenStreetMap edits as **pipeline inputs**. These sources exist solely for **validation and accuracy assessment**. Using them as inputs would be circular and scientifically invalid.

### 2. No invented numbers

Never invent numbers, thresholds, validation scores, model names, or method claims. Any value that is not computed by real, running code must be clearly labelled **mock** or **placeholder** in both the UI and the codebase. This includes KPIs, precision/recall figures, area estimates, population counts, and model architecture descriptions.

### 3. No hardcoded case-study values in reusable code

Never hardcode Trishuli coordinates, flood dates, village names, damage thresholds, or damage counts in pipeline logic or API code. The pipeline and API must be area- and event-agnostic. Case-study–specific values belong in configuration files, seed data, or test fixtures — not in production code paths.
