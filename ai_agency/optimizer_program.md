# Autoresearch: Prompt Optimization

This is an autonomous loop where you (the LLM) improve an AI Voice Agent's master sales prompt to maximize its booking conversion rate.

## Setup
1. **The Goal**: Maximize the `conversion_score` metric.
2. **The Target File**: You ONLY edit `target_prompt.md`. Do NOT edit `simulate_calls.py`.
3. **The Script**: To run an experiment, execute `python3 simulate_calls.py`. This script runs 10 simulated text-based conversations against "Hard Mode" LLM personas (Skeptical owners, busy mechanics) that are pre-configured in the simulator.
4. **The Results File**: Record your experiments in `results.tsv` (columns: commit, conversion_score, status, description).

## The Loop
1. Edit `target_prompt.md` to change a psychological angle (e.g., tone, offer urgency, objection handling).
2. Commit the change locally via `git commit -a -m "Brief description"`.
3. Run the evaluation: `python3 simulate_calls.py > run.log 2>&1`
4. Read the output from the log: `grep "conversion_score:" run.log`
5. Record the result in `results.tsv`.
6. **Decision**:
   - If `conversion_score` improves (higher is better), keep the commit and advance the branch.
   - If `conversion_score` stays the same or drops, use `git reset --hard HEAD~1` to revert the prompt back to what it was, and try a different angle.
7. **NEVER STOP**. You process 100s of iterations continuously until manually interrupted by the user.

## Constraints
- Max time per simulated batch: 5 minutes.
- If the simulation crashes due to prompt syntax errors, read the error, fix the prompt, and rerun. If it keeps crashing, revert the change.
- Keep the `target_prompt.md` concise. Adding 10 paragraphs of fluff hurts conversions.
