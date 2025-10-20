# Baserow Import Order

Import these JSON files in the following order to maintain foreign key relationships:

## Order of Import:

1. **01-habit-categories-data.json** - Base categories (no dependencies)
2. **02-habit-subcategories-data.json** - Depends on categories
3. **03-habit-groups-data.json** - Depends on subcategories
4. **04-achievements-data.json** - Independent table
5. **12-habit-templates-data.json** - Depends on categories, subcategories, groups
6. **05-habits-data.json** - Depends on categories, subcategories, groups
7. **06-habit-entries-data.json** - Depends on habits
8. **07-exercise-details-data.json** - Depends on habits
9. **08-game-state-data.json** - Independent user data
10. **09-user-achievements-data.json** - Depends on achievements
11. **10-nightly-plans-data.json** - Independent user data
12. **11-analytics-summary-data.json** - Independent user data
13. **13-user-settings-data.json** - Independent user data
14. **14-notification-preferences-data.json** - Depends on habits

## Notes:

- All files are formatted as pure JSON arrays ready for Baserow import
- Each file contains sample data with proper foreign key relationships
- User IDs are consistent across all tables (user_001, user_002, user_003)
- Habit IDs reference the habits created in step 6
- Achievement IDs reference the achievements created in step 4
- Category/subcategory/group IDs maintain the hierarchy

## Import Process:

1. Create tables in Baserow with the appropriate field types
2. Import each JSON file in the order listed above
3. Verify foreign key relationships after each import
4. Test the data relationships before proceeding to the next file

The data includes:
- 8 habit categories with hierarchy
- 10 sample habits with tracking data
- Multiple users with different progress levels
- Achievements, analytics, and user preferences
- Exercise details for workout habits
- Notification preferences and settings