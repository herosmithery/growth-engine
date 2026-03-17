# Autoresearch: Frontend Dashboard Builder

This is an autonomous loop where you (the LLM) improve an HTML/React/Tailwind dashboard UI.

## Setup
1. **The Goal**: Maximize the `ux_score` metric.
2. **The Target File**: You ONLY edit `/Users/johnkraeger/Downloads/growth engine /app/clients/page.tsx`. Do NOT edit `evaluate_ui.py`.
3. **The Script**: To run an experiment, execute `uv run evaluate_ui.py`. This script uses Playwright to render `http://localhost:3000/clients`, takes a screenshot, and uses an LLM-as-a-Judge to grade the aesthetic and layout.
4. **The Results File**: Record your experiments in `ui_results.tsv` (columns: commit, ux_score, status, description).

## The Loop
1. Edit `/Users/johnkraeger/Downloads/growth engine /app/clients/page.tsx` to improve the UI (e.g., better colors, adding missing components, fixing layout issues).
2. Commit the change locally via `git commit -a -m "Brief description of UI change"`.
3. Run the evaluation: `uv run evaluate_ui.py > run.log 2>&1`
4. Read the output from the log: `grep "ux_score:" run.log`
5. Record the result in `ui_results.tsv`.
6. **Decision**:
   - If `ux_score` improves (higher is better), keep the commit and advance the branch.
   - If `ux_score` stays the same or drops (or the UI breaks and gets a 0), use `git reset --hard HEAD~1` to revert the code back to what it was, and try a different approach.
7. **NEVER STOP**. You process 100s of iterations continuously until manually interrupted by the user.

## Constraints
- Max time per evaluation: ~30 seconds.
- Since it's a single file, keep React/Tailwind scripts loaded via CDN.
- Prioritize making it look like a premium, million-dollar SaaS product.
