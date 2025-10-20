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

## Database Relationships:

- **Categories → Subcategories → Groups → Exercise Details** (Hierarchical)
- **Categories/Subcategories/Groups → Habits** (Classification)
- **Habits → Habit Entries → Habit Proof** (Tracking Chain)
- **Exercise Details + Habit Entries → Exercise Sets** (Workout Tracking)
- **Achievements → User Achievements** (Gamification)

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