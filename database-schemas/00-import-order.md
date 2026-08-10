# Baserow Database Import Order

Import these JSON files in the exact order listed below to respect foreign key dependencies:

## Import Order:

1. **01-habit-categories.json** - Main habit categories (no dependencies)
2. **02-habit-subcategories.json** - Subcategories (depends on categories)
3. **03-habit-groups.json** - Groups within subcategories (depends on subcategories)
4. **04-exercise-details.json** - Exercise definitions (depends on groups)
5. **05-achievements.json** - Available achievements (independent)
6. **06-habit-templates.json** - Pre-built habit templates (depends on categories/subcategories)
7. **07-habits.json** - Individual habit instances (depends on categories/subcategories/groups)
8. **08-game-state.json** - User gamification data (independent)
9. **09-habit-entries.json** - Daily habit completions (depends on habits)
10. **10-habit-proof.json** - Proof documentation (depends on habit entries)
11. **11-exercise-sets.json** - Workout set tracking (depends on habit entries & exercise details)
12. **12-user-achievements.json** - Earned achievements (depends on achievements)
13. **13-nightly-plans.json** - Planning & reflection entries (independent)
14. **14-analytics-summary.json** - Pre-computed analytics (independent)

### Friends & Campaigns

15. **15-friendships.json** - Social graph; a friend request is a friendship in `pending` (independent)
16. **16-campaigns.json** - Shared accountability agreements (independent)
17. **17-campaign-participants.json** - Membership + which rules version each user consented to (depends on campaigns)
18. **18-campaign-rule-versions.json** - Append-only negotiation history (depends on campaigns)
19. **19-campaign-reports.json** - Per-participant, per-period check-ins + adjudication (depends on campaign participants)
20. **20-campaign-pledges.json** - Declarations of intent; **no payment fields** (depends on campaign participants)
21. **21-campaign-settlements.json** - Self-reported obligations after an outcome (depends on campaign pledges)
22. **22-campaign-events.json** - Append-only hash-chained audit trail (depends on campaigns)

After importing 15–22, record each table's numeric id in `src/environments/environment.ts`
under `baserow.tables` — they ship as `0`, and the campaign services no-op with a
console warning until real ids are filled in.

23. **23-daily-content.json** - Rotating daily inspiration (independent)
24. **24-level-records.json** - Append-only level ledger (independent)
25. **25-challenge-templates.json** - Challenge catalogue (independent)
26. **26-user-onboarding.json** - Setup-wizard + app-guide state, one row per user (independent)

Same rule for 23–26: record the id in `environment.ts`. Each owning service keeps
its state in localStorage while the id is `0` and flushes once a real one appears.

## Database Relationships:

- **Categories → Subcategories → Groups → Exercise Details** (Hierarchical)
- **Categories/Subcategories/Groups → Habits** (Classification)
- **Habits → Habit Entries → Habit Proof** (Tracking Chain)
- **Exercise Details + Habit Entries → Exercise Sets** (Workout Tracking)
- **Achievements → User Achievements** (Gamification)
- **Campaigns → Participants → Reports** (Accountability Chain)
- **Campaigns → Rule Versions / Events** (Append-only audit)
- **Participants → Pledges → Settlements** (Stake Chain)

## Users are not a Baserow table

Users live in **Xano**. Every user reference in tables 15–22 is a plain `text`
field holding `String(user.id)` — never a `link` field. Link fields are used only
between campaign tables. Each child table also carries a redundant `campaign_key`
text column so clients can filter without knowing the parent's numeric row id.

This is also *why* per-user onboarding state lives in its own table
(`26-user-onboarding.json`) rather than as columns on a user record: there is no
user record here to add columns to, and adding them in Xano would mean editing
the workspace, the `/users/update` endpoint and `/auth/me`'s response shape —
three changes outside version control.

Note that `users-table-schema.json` in this directory is **not authoritative**.
It predates the move to Xano, is not in the numbered import sequence, and nothing
reads it. Do not resurrect it without first deciding where users actually live.

## Money

Habiti **records** campaign pledges and settlements. It never holds, escrows, or
transfers funds — there are deliberately no payment fields in `20-campaign-pledges.json`.
On a failed staked campaign the user is shown a donation link and gives directly to
the iLuv Foundation. See the `notes` block in that file before adding any field.

## Sample Data Included:

Each file contains realistic sample data with:
- **3 users** (user_001, user_002, user_003) at different progress levels
- **Multiple categories** covering health, productivity, learning, mindfulness, social
- **Complete workout data** with exercises, sets, reps, weights
- **Achievement progression** from beginner to advanced
- **Nightly planning entries** with detailed reflections
- **Analytics data** for dashboard charts and metrics

## Notes:

- All foreign key relationships are properly maintained
- Sample data includes realistic timestamps and progression
- User_001 is an advanced user with lots of data
- User_002 is intermediate with moderate progress  
- User_003 is a new user just getting started
- Data spans multiple days for trend analysis
- All tracking types are represented (simple, quantity, duration, sets)