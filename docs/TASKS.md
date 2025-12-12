# 📋 Habiti Task Management Index

**Last Updated:** 2025-12-07

This document serves as the central index for all feature tasks and development work in the Habiti application.

## 📁 Directory Structure

```
docs/
├── tasks/              # Feature task specifications (sorted by date)
├── setup-guides/       # Setup and configuration guides
└── database-schemas/   # Database schema JSON files
```

## 🎯 Active Tasks (In Progress)

### Analytics Dashboard
**File:** [tasks/20251207-analytics-dashboard-in-progress.md](tasks/20251207-analytics-dashboard-in-progress.md)
- **Status:** In Progress (3/49 tasks completed)
- **Progress:** Key Metrics Cards ✅, Completion Timeline ✅, Habit Comparison ✅
- **Next:** Streak History, Heatmap Calendar, Day of Week Analysis

### Dashboard UI
**File:** [tasks/20251206-dashboard-ui-in-progress.md](tasks/20251206-dashboard-ui-in-progress.md)
- **Status:** In Progress (3/50 tasks completed)
- **Progress:** UI refinements completed
- **Next:** Enhanced visualizations, advanced statistics

---

## 📝 Planned Tasks

### Core Features

#### Habits System
**File:** [tasks/20251206-habits-system-planned.md](tasks/20251206-habits-system-planned.md)
- **Status:** Planned (0/42 tasks)
- **Scope:** Enhanced habit creation, tracking types, management features
- **Priority:** High

#### Gamification Features
**File:** [tasks/20251206-gamification-features-planned.md](tasks/20251206-gamification-features-planned.md)
- **Status:** Planned (0/31 tasks)
- **Scope:** Achievements, challenges, leaderboards, rewards
- **Priority:** Medium

#### Calendar Views
**File:** [tasks/20251206-calendar-views-planned.md](tasks/20251206-calendar-views-planned.md)
- **Status:** Planned (0/23 tasks)
- **Scope:** Month/week/day views, habit event display
- **Priority:** Medium

#### Calendar Advanced Features
**File:** [tasks/20251206-calendar-advanced-planned.md](tasks/20251206-calendar-advanced-planned.md)
- **Status:** Planned (0/63 tasks)
- **Scope:** Advanced calendar integration, scheduling
- **Priority:** Low

#### Planner System
**File:** [tasks/20251206-planner-system-planned.md](tasks/20251206-planner-system-planned.md)
- **Status:** Planned (0/27 tasks)
- **Scope:** Daily/weekly/monthly planning, nightly reflections
- **Priority:** Medium

#### Pomodoro Timer
**File:** [tasks/20251206-pomodoro-timer-planned.md](tasks/20251206-pomodoro-timer-planned.md)
- **Status:** Planned (0/24 tasks)
- **Scope:** Timer integration, work session tracking
- **Priority:** Low

#### Project Management
**File:** [tasks/20251206-project-management-planned.md](tasks/20251206-project-management-planned.md)
- **Status:** Planned (0/39 tasks)
- **Scope:** Project creation, task management, collaboration
- **Priority:** Medium

#### UI Improvements
**File:** [tasks/20251206-ui-improvements-planned.md](tasks/20251206-ui-improvements-planned.md)
- **Status:** Planned (0/12 tasks)
- **Scope:** Layout improvements, sample data, responsive design
- **Priority:** Medium

---

## 📊 Task Statistics

| Status | Count | Tasks Completed | Tasks Remaining |
|--------|-------|-----------------|-----------------|
| ✅ In Progress | 2 | 6 | 93 |
| 📋 Planned | 8 | 0 | 261 |
| **Total** | **10** | **6** | **354** |

### Overall Progress
- **Total Tasks:** 360
- **Completed:** 6 (1.7%)
- **In Progress:** 93 (25.8%)
- **Planned:** 261 (72.5%)

---

## 🎯 Task Naming Convention

All task files follow this naming pattern:
```
YYYYMMDD-feature-name-status.md
```

**Components:**
- `YYYYMMDD` - Date created/modified (for sorting)
- `feature-name` - Descriptive kebab-case name
- `status` - One of: `planned`, `in-progress`, `completed`

**Examples:**
- `20251207-analytics-dashboard-in-progress.md`
- `20251206-habits-system-planned.md`
- `20251215-user-authentication-completed.md`

---

## 🔄 Workflow

### Moving Tasks Between States

When a task changes status, rename the file:

```bash
# Starting work on a planned task
mv docs/tasks/YYYYMMDD-feature-planned.md \
   docs/tasks/YYYYMMDD-feature-in-progress.md

# Completing a task
mv docs/tasks/YYYYMMDD-feature-in-progress.md \
   docs/tasks/YYYYMMDD-feature-completed.md
```

### Creating New Tasks

1. Create file with today's date and `planned` status
2. Add to appropriate section in this index
3. Update statistics

---

## 📂 Related Documentation

### Setup Guides
Located in [setup-guides/](setup-guides/)
- BASEROW_SETUP.md
- XANO_SETUP_GUIDE.md
- DATABASE_SCHEMA_PLAN.md
- CLAUDE_AUTOMATION_GUIDE.md
- And more...

### Database Schemas
Located in [database-schemas/](database-schemas/)
- Baserow table schemas
- Sample data JSON files
- Import order documentation

---

## 🚀 Quick Links

- **Main README:** [../README.md](../README.md)
- **Claude Instructions:** [../CLAUDE.md](../CLAUDE.md)
- **Task Directory:** [tasks/](tasks/)
- **Setup Guides:** [setup-guides/](setup-guides/)
- **Database Schemas:** [database-schemas/](database-schemas/)

---

**Note:** This index is automatically updated when tasks are created, modified, or completed. Always check file modification dates for the most recent changes.
