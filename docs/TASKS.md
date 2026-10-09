# 📋 Habiti Task Management Index

**Last Updated:** 2026-08-15

This document serves as the central index for all feature tasks and development work in the Habiti application.

## 📁 Directory Structure

```
docs/
├── tasks/              # Feature task specifications (sorted by date)
├── setup-guides/       # Setup and configuration guides
└── database-schemas/   # Database schema JSON files
```

## 📘 Playbooks

- **[setup-guides/BASEROW_PENDING_SETUP.md](setup-guides/BASEROW_PENDING_SETUP.md)** —
  the five tables and four columns the app is waiting on, and the single command
  that creates them: `npm run db:setup -- --apply --write-env`.

- **[REALTIME_FEATURE_PLAYBOOK.md](REALTIME_FEATURE_PLAYBOOK.md)** — how to ask
  for and build any feature where one user acts and another sees it instantly
  with a toast. Includes a reusable prompt, the seven-link chain, and the
  debugging order. Read it before wiring realtime into a new feature.

## ✅ Recently Completed

### New-User Onboarding
**File:** [tasks/20260809-onboarding-completed.md](tasks/20260809-onboarding-completed.md)
- **Status:** Completed 2026-08-09
- **Scope:** Skippable five-step setup wizard, ten-step interactive spotlight
  guide, per-page first-visit tips
- **Blocking follow-up:** create Baserow table 26 and set
  `environment.ts → baserow.tables.userOnboarding` (runs local-only until then)
- **Also fixed:** game-state load discarding preferences and achievements,
  templated habits saving with no category, theme toggle not persisting

---

## 🎯 Active Tasks (In Progress)

### Mind Maps
**File:** [tasks/20260815-mind-maps-in-progress.md](tasks/20260815-mind-maps-in-progress.md)
- **Status:** In Progress (25/33 tasks) — phases 0–4 plus a right-click menu, 2026-08-15
- **Scope:** EdrawMind-style tree editor at `/maps`, standalone or inside a
  project, keyboard-first, with nodes that carry real tasks
- **Bundle:** the editor is a 36.8 kB LAZY chunk; the initial bundle grew 1.2 kB.
  The `ResettableRegistry` it introduced gave back 14.2 kB by moving attachments,
  checklists and inspiration off the eager path — headroom is 24.2 kB, up from 11.2
- **Blocking follow-up:** tables 34 and 35 need a Baserow user JWT; maps are
  local-only until then
- **Next:** PNG export, themes, search, viewport culling for very large maps
- **Also has:** a generic `app-context-menu` (keyboard-operable, edge-flipping,
  long-press on touch) reusable outside the map

### Task & Project Management
**File:** [tasks/20260815-task-management-in-progress.md](tasks/20260815-task-management-in-progress.md)
- **Status:** In Progress (35/45 tasks) — phases 0–4 built 2026-08-15
- **Scope:** Attachments (documents/images/video), progress and status tracking,
  `/tasks/:id` view and `/tasks/:id/edit` pages, project detail pages, tasks
  standalone or inside a project
- **Phase 0 fixed the foundation:** the mappers wrote field names that tables
  630/631 do not have, and Baserow drops those silently — task completion never
  reached the server, and every project row on it has a null title.
  `npm run verify:fields` now fails the build if that recurs.
- **Blocking follow-up:** three Baserow schema commands need a user JWT — create
  tables 31 and 32, add `status`/`progress_pct` to 631. Attachments and
  checklists stay on one browser until then (see §13 of the task file).
- **Next:** phase 5 — uploads behind the relay, real file deletion, attachments
  in the data export

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
| ✅ In Progress | 4 | 66 | 111 |
| 📋 Planned | 8 | 0 | 261 |
| **Total** | **12** | **66** | **372** |

### Overall Progress
- **Total Tasks:** 438
- **Completed:** 66 (15.1%)
- **In Progress:** 111 (25.3%)
- **Planned:** 261 (59.6%)

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
