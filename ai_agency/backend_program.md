# Backend Data Flow Optimizer - Autonomous Program

## Goal
Maximize the `sync_score` metric (0-100) by optimizing Aria's voice prompts and the Next.js webhook logic.

## Setup
1. **The Target Files**: 
   - `/Users/johnkraeger/Downloads/growth engine /app/api/vapi/webhook/route.ts` (Logic)
   - `/Users/johnkraeger/Downloads/growth engine /lib/niches/glo-medspa.ts` (Prompt)
2. **The Script**: To run an experiment, execute `uv run validate_data_flow.py`. This script simulates a Vapi call and verifies that the client and call log appear correctly in Supabase.
3. **The Results File**: Record your experiments in `backend_results.tsv` (columns: commit, sync_score, status, description).

## The Loop
1. Edit either the `webhook/route.ts` (to handle data parsing better) or `glo-medspa.ts` (to make Aria extract data better).
2. Commit the change: `git commit -a -m "Backend optimization: [Details]"`
3. Run the evaluation: `uv run validate_data_flow.py > sync_run.log 2>&1`
4. Check the score: `grep "sync_score:" sync_run.log`
5. If the score increases, keep the change. If it decreases, revert and try a different approach.

## Constraints
- Do NOT break the Supabase connection strings.
- Ensure `handleCallEnd` handles edge cases like missing customer names or malformed phone numbers.
- Aria's prompt should always prioritize "Confirming Name, Phone, and Appointment Time" to ensure high ingestion quality.
