# 📥 Baserow Import Guide - CORRECTED

## 🚨 Important Fixes

This corrected guide addresses the issues you found:
1. **Rollup field syntax**: Uses proper `Count(field('tasks'))` format
2. **Task_Updates structure**: Separate `task_reference` field instead of link field as ID
3. **Correct Baserow function syntax**: Uses `date_diff()` and `today()` functions

## 📋 Table Creation Order

**Import in this exact order:**

1. **Categories** (Table ID: 500)
2. **Agents** (Table ID: 501)  
3. **Projects** (Table ID: 502)
4. **Tasks** (Table ID: 503)
5. **Task_Updates** (Table ID: 504) ⚠️ **CORRECTED STRUCTURE**
6. **Comments** (Table ID: 505)
7. **Milestones** (Table ID: 506)
8. **Sessions** (Table ID: 507)

## 🔧 Step-by-Step Setup

### 1. Categories Table (ID: 500)
```bash
# Create fields:
- name (Single line text) ✅ Required
- description (Long text)
- color (Single line text)
- order (Number)
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required
- status (Single select: active, archived, planned) ✅ Required

# Import: sample_data/01_categories.json
```

**✅ CORRECTED - Add these calculated fields AFTER import:**
```bash
# Count field (not rollup):
- task_count: Count field → Select "tasks" link field

# OR use Formula field:
- task_count_formula: Formula field → Count(field('tasks'))
```

### 2. Agents Table (ID: 501)
```bash
# Create fields:
- name (Single line text) ✅ Required
- description (Long text)
- specialization (Multiple select: frontend, backend, design, ai, devops)
- avatar_url (URL)
- status (Single select: active, busy, offline) ✅ Required
- created_at (Date) ✅ Required

# Import: sample_data/02_agents.json
```

**✅ CORRECTED - Add calculated fields AFTER import:**
```bash
# Count fields:
- active_tasks: Count field → Select "tasks" where status != "completed"
- completed_tasks: Count field → Select "tasks" where status = "completed" OR "approved"
```

### 3. Projects Table (ID: 502)
```bash
# Create fields:
- name (Single line text) ✅ Required
- description (Long text)
- start_date (Date)
- target_date (Date)
- status (Single select: planning, active, on_hold, completed) ✅ Required
- priority (Single select: low, medium, high, critical) ✅ Required
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required

# Import: sample_data/03_projects.json
```

**✅ CORRECTED - Add calculated fields AFTER import:**
```bash
# Count and Formula fields:
- task_count: Count field → Select "tasks" link field
- completed_tasks: Count field → Select "tasks" where status = "completed" OR "approved"
- completion_rate: Formula field → if(field('task_count') > 0, field('completed_tasks') / field('task_count') * 100, 0)
```

### 4. Tasks Table (ID: 503)
```bash
# Create fields:
- task_id (Single line text) ✅ Required ✅ Unique
- title (Single line text) ✅ Required
- description (Long text)
- category_id (Link to Categories) ✅ Required
- project_id (Link to Projects) ✅ Required
- assigned_agent_id (Link to Agents)
- priority (Single select: low, medium, high, critical) ✅ Required
- phase (Single line text)
- estimated_hours (Number)
- actual_hours (Number)
- status (Single select: pending, in_progress, completed, approved, blocked) ✅ Required
- completed_at (Date)
- approved_at (Date)
- due_date (Date)
- tags (Multiple select: bug, feature, improvement, docs)
- dependencies (Long text)
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required

# Import: sample_data/04_tasks.json
```

**✅ CORRECTED - Add calculated fields AFTER import:**
```bash
# Lookup fields:
- category_name: Lookup field → From "category_id" link → Select "name" field
- project_name: Lookup field → From "project_id" link → Select "name" field  
- agent_name: Lookup field → From "assigned_agent_id" link → Select "name" field

# Formula fields:
- days_open: Formula field → date_diff('day', field('created_at'), today())
- is_overdue: Formula field → and(field('due_date'), field('due_date') < today(), field('status') != 'completed', field('status') != 'approved')
```

### 5. Task_Updates Table (ID: 504) ⚠️ **CORRECTED STRUCTURE**

```bash
# Create fields:
- task_id (Link to Tasks) ✅ Required
- task_reference (Single line text) ✅ Required # ← NEW: Stores task_id like "analytics-1"
- action (Single select: created, updated, completed, approved, disapproved, note_added, assigned, blocked, unblocked) ✅ Required
- field_changed (Single line text)
- old_value (Long text)
- new_value (Long text)
- notes (Long text)
- agent_id (Link to Agents)
- timestamp (Date) ✅ Required
- session_id (Single line text)

# Import: sample_data/05_task_updates.json (UPDATED with task_reference field)
```

**✅ CORRECTED - Add lookup fields AFTER import:**
```bash
# Lookup fields:
- task_title: Lookup field → From "task_id" link → Select "title" field
- agent_name: Lookup field → From "agent_id" link → Select "name" field
```

### 6. Comments Table (ID: 505)
```bash
# Create fields:
- task_id (Link to Tasks) ✅ Required
- agent_id (Link to Agents)
- parent_id (Link to Comments) # Self-reference for replies
- content (Long text) ✅ Required
- type (Single select: comment, review, feedback, question) ✅ Required
- is_resolved (Checkbox) ✅ Required
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required

# Import: sample_data/06_comments.json
```

**Add lookup fields AFTER import:**
```bash
- task_title: Lookup field → From "task_id" link → Select "title" field
- agent_name: Lookup field → From "agent_id" link → Select "name" field
```

### 7. Milestones Table (ID: 506)
```bash
# Create fields:
- project_id (Link to Projects) ✅ Required
- title (Single line text) ✅ Required
- description (Long text)
- target_date (Date) ✅ Required
- completed_date (Date)
- progress (Number 0-100) ✅ Required
- status (Single select: upcoming, in_progress, completed, overdue) ✅ Required
- created_at (Date) ✅ Required

# Import: sample_data/07_milestones.json
```

**Add calculated fields AFTER import:**
```bash
- project_name: Lookup field → From "project_id" link → Select "name" field
- is_overdue: Formula field → and(field('status') != 'completed', field('target_date') < today())
```

### 8. Sessions Table (ID: 507)
```bash
# Create fields:
- session_id (Single line text) ✅ Required ✅ Unique
- start_time (Date) ✅ Required
- end_time (Date)
- agent_type (Single line text)
- tasks_worked (Number) ✅ Required
- tasks_completed (Number) ✅ Required
- summary (Long text)
- status (Single select: active, completed, interrupted) ✅ Required

# Import: sample_data/08_sessions.json
```

**Add calculated fields AFTER import:**
```bash
- session_duration: Formula field → if(field('end_time'), date_diff('hour', field('start_time'), field('end_time')), date_diff('hour', field('start_time'), today()))
```

## ✅ Corrected Formula Examples

### Working Date/Time Formulas
```bash
# Days since task created:
date_diff('day', field('created_at'), today())

# Is task overdue:
and(field('due_date'), field('due_date') < today(), field('status') != 'completed')

# Completion rate percentage:
if(field('task_count') > 0, field('completed_tasks') / field('task_count') * 100, 0)

# Session duration in hours:
if(field('end_time'), date_diff('hour', field('start_time'), field('end_time')), 0)
```

### Working Count Field Setup
```bash
# In Categories table:
1. Add Count field
2. Select "Link to table" field: tasks
3. Field name: task_count
4. (Optional) Add filter: status = 'active'

# Alternative with Formula:
Count(field('tasks'))
```

### Working Rollup Field Setup
```bash
# In Categories table for completed task count:
1. Add Rollup field  
2. Select "Link to table" field: tasks
3. Select field to rollup: status
4. Rollup function: count
5. Add filter: status = 'completed' OR status = 'approved'
```

## 🎯 Views Setup (Recommended)

### 1. Active Tasks Dashboard
- **Table**: Tasks
- **Filter**: status = "pending" OR "in_progress"
- **Sort**: priority DESC, due_date ASC
- **Group**: category_name

### 2. Review Queue
- **Table**: Tasks  
- **Filter**: status = "completed"
- **Sort**: completed_at ASC
- **Color**: Yellow background

### 3. Agent Workload
- **Table**: Tasks
- **Filter**: status != "completed" AND status != "approved"
- **Group**: agent_name
- **Sort**: priority DESC

### 4. Recent Activity
- **Table**: Task_Updates
- **Filter**: timestamp >= today() - '7 days'
- **Sort**: timestamp DESC
- **Limit**: 50 records

## 🔍 Verification Checklist

After setup, verify:
- [ ] Categories show task counts using Count field
- [ ] Tasks display category/project/agent names (not IDs)
- [ ] Task_Updates link properly to tasks via link field
- [ ] Task_Updates have task_reference for easy searching
- [ ] Date formulas calculate correctly (days_open, is_overdue)
- [ ] Count fields show correct numbers
- [ ] Lookup fields display names instead of IDs

## 💡 Key Corrections Made

1. **Count Fields**: Use dedicated Count field type, not rollup with Count(field('tasks'))
2. **Task_Updates**: Added `task_reference` text field for storing task IDs like "analytics-1"
3. **Date Functions**: Use `date_diff('day', start, end)` and `today()` functions
4. **Formula Syntax**: Use `and()`, `if()`, and proper field references
5. **Rollup Setup**: Proper configuration with link field selection and function choice

This corrected structure will work properly with Baserow's current field types and function syntax!

<system-reminder>
The TodoWrite tool hasn't been used recently. If you're working on tasks that would benefit from tracking progress, consider using the TodoWrite tool to track progress. Also consider cleaning up the todo list if has become stale and no longer matches what you are working on. Only use it if it's relevant to the current work. This is just a gentle reminder - ignore if not applicable.


Here are the existing contents of your todo list:

[1. [completed] Research Baserow rollup functions and syntax
2. [completed] Research Baserow calculated field functions
3. [completed] Fix task_updates table structure for proper ID references
4. [in_progress] Update import guide with correct field configurations]
</system-reminder>