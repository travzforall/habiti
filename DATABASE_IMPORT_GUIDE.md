# 📥 Database Import & Setup Guide

## 🏗️ Table Creation Order

**Important**: Import tables in this exact order to maintain referential integrity:

1. **Categories** (Table ID: 500) - No dependencies
2. **Agents** (Table ID: 501) - No dependencies  
3. **Projects** (Table ID: 502) - No dependencies
4. **Tasks** (Table ID: 503) - Links to Categories, Projects, Agents
5. **Task_Updates** (Table ID: 504) - Links to Tasks, Agents
6. **Comments** (Table ID: 505) - Links to Tasks, Agents, Comments (self-reference)
7. **Milestones** (Table ID: 506) - Links to Projects
8. **Sessions** (Table ID: 507) - No dependencies

## 📋 Step-by-Step Import Process

### 1. Create Base Tables (No Dependencies)

#### Categories Table (ID: 500)
```bash
# Create table with these fields:
- name (Single line text) ✅ Required
- description (Long text)
- color (Single line text)
- order (Number)
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required
- status (Single select: active, archived, planned) ✅ Required

# Import: sample_data/01_categories.json
```

#### Agents Table (ID: 501)
```bash
# Create table with these fields:
- name (Single line text) ✅ Required
- description (Long text) 
- specialization (Multiple select: frontend, backend, design, ai, devops)
- avatar_url (URL)
- status (Single select: active, busy, offline) ✅ Required
- created_at (Date) ✅ Required

# Import: sample_data/02_agents.json
```

#### Projects Table (ID: 502)
```bash
# Create table with these fields:
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

### 2. Create Dependent Tables

#### Tasks Table (ID: 503)
```bash
# Create table with these fields:
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
- dependencies (Long text) # JSON array format
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required

# IMPORTANT: Set up these Lookup fields after import:
- category_name (Lookup from Categories → name)
- project_name (Lookup from Projects → name)
- agent_name (Lookup from Agents → name)

# Import: sample_data/04_tasks.json
```

#### Task_Updates Table (ID: 504)
```bash
# Create table with these fields:
- task_id (Link to Tasks) ✅ Required
- action (Single select: created, updated, completed, approved, disapproved, note_added, assigned, blocked, unblocked) ✅ Required
- field_changed (Single line text)
- old_value (Long text)
- new_value (Long text)
- notes (Long text)
- agent_id (Link to Agents)
- timestamp (Date) ✅ Required
- session_id (Single line text)

# IMPORTANT: Set up these Lookup fields after import:
- task_title (Lookup from Tasks → title)
- agent_name (Lookup from Agents → name)

# Import: sample_data/05_task_updates.json
```

#### Comments Table (ID: 505)
```bash
# Create table with these fields:
- task_id (Link to Tasks) ✅ Required
- agent_id (Link to Agents)
- parent_id (Link to Comments) # Self-reference for replies
- content (Long text) ✅ Required
- type (Single select: comment, review, feedback, question) ✅ Required
- is_resolved (Checkbox) ✅ Required
- created_at (Date) ✅ Required
- updated_at (Date) ✅ Required

# IMPORTANT: Set up these Lookup fields after import:
- task_title (Lookup from Tasks → title)
- agent_name (Lookup from Agents → name)

# Import: sample_data/06_comments.json
```

#### Milestones Table (ID: 506)
```bash
# Create table with these fields:
- project_id (Link to Projects) ✅ Required
- title (Single line text) ✅ Required
- description (Long text)
- target_date (Date) ✅ Required
- completed_date (Date)
- progress (Number 0-100) ✅ Required
- status (Single select: upcoming, in_progress, completed, overdue) ✅ Required
- created_at (Date) ✅ Required

# IMPORTANT: Set up these Lookup fields after import:
- project_name (Lookup from Projects → name)

# Import: sample_data/07_milestones.json
```

#### Sessions Table (ID: 507)
```bash
# Create table with these fields:
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

## 🔗 Setting Up Relationships & Lookups

### After importing all data, configure these relationships:

#### 1. Link Fields Setup
- **Tasks → Categories**: Link `category_id` to Categories table
- **Tasks → Projects**: Link `project_id` to Projects table
- **Tasks → Agents**: Link `assigned_agent_id` to Agents table
- **Task_Updates → Tasks**: Link `task_id` to Tasks table
- **Task_Updates → Agents**: Link `agent_id` to Agents table
- **Comments → Tasks**: Link `task_id` to Tasks table
- **Comments → Agents**: Link `agent_id` to Agents table
- **Comments → Comments**: Link `parent_id` to Comments table (self-reference)
- **Milestones → Projects**: Link `project_id` to Projects table

#### 2. Lookup Fields Configuration
```bash
# In Tasks table:
- category_name: Lookup from Categories via category_id → name
- project_name: Lookup from Projects via project_id → name  
- agent_name: Lookup from Agents via assigned_agent_id → name

# In Task_Updates table:
- task_title: Lookup from Tasks via task_id → title
- agent_name: Lookup from Agents via agent_id → name

# In Comments table:
- task_title: Lookup from Tasks via task_id → title
- agent_name: Lookup from Agents via agent_id → name

# In Milestones table:
- project_name: Lookup from Projects via project_id → name
```

## 📊 Calculated Fields (Optional but Recommended)

### Categories Table
```bash
# Add these formula fields:
- task_count: Rollup from Tasks → Count(All)
- completed_count: Rollup from Tasks where status="completed" OR "approved"
```

### Projects Table  
```bash
# Add these formula fields:
- task_count: Rollup from Tasks → Count(All)
- completed_tasks: Rollup from Tasks where status="completed" OR "approved"
- completion_rate: Formula → completed_tasks / task_count * 100
```

### Tasks Table
```bash
# Add these formula fields:
- days_open: Formula → DATETIME_DIFF(NOW(), created_at, 'days')
- is_overdue: Formula → AND(due_date, due_date < NOW(), status != 'completed', status != 'approved')
```

### Agents Table
```bash
# Add these formula fields:
- active_tasks: Rollup from Tasks where status="pending" OR "in_progress"
- completed_tasks: Rollup from Tasks where status="completed" OR "approved"
```

## 🎯 Views Setup

Create these views for better data management:

### 1. Active Tasks View
- **Filter**: Status = "pending" OR "in_progress"
- **Sort**: Priority DESC, Due Date ASC
- **Group**: By Agent

### 2. Review Queue View  
- **Filter**: Status = "completed" (not approved)
- **Sort**: Completed Date ASC
- **Group**: By Category

### 3. Overdue Tasks View
- **Filter**: Due Date < NOW() AND Status != "completed" AND Status != "approved"
- **Sort**: Due Date ASC
- **Color**: Red background

### 4. Agent Workload View
- **Table**: Tasks
- **Group**: By Agent
- **Summary**: Count tasks, Sum estimated hours
- **Filter**: Status = "pending" OR "in_progress"

### 5. Recent Activity View
- **Table**: Task_Updates  
- **Filter**: Timestamp > 7 days ago
- **Sort**: Timestamp DESC
- **Limit**: 50 records

## 🚀 Verification Checklist

After import, verify these connections work:

- [ ] Tasks show category names (not just IDs)
- [ ] Tasks show project names (not just IDs)
- [ ] Tasks show agent names (not just IDs)
- [ ] Task updates link to correct tasks
- [ ] Comments link to correct tasks and agents
- [ ] Milestones link to correct projects
- [ ] Comment replies link to parent comments
- [ ] All calculated fields are computing correctly

## 🔄 Data Relationships Summary

```
Projects (1) ←→ (Many) Tasks
Categories (1) ←→ (Many) Tasks  
Agents (1) ←→ (Many) Tasks
Tasks (1) ←→ (Many) Task_Updates
Tasks (1) ←→ (Many) Comments
Agents (1) ←→ (Many) Task_Updates
Agents (1) ←→ (Many) Comments
Comments (1) ←→ (Many) Comments [Replies]
Projects (1) ←→ (Many) Milestones
```

## 💡 Pro Tips

1. **Import Order Matters**: Always import parent tables before child tables
2. **Test Relationships**: After each table import, verify links work correctly
3. **Backup Before Import**: Save your empty table structure before importing data
4. **Use Sample Data**: The provided samples create a realistic project scenario
5. **Validate Lookups**: Check that lookup fields display names, not IDs
6. **Set Permissions**: Configure appropriate access levels for different user types

---

**🎉 Once complete, you'll have a fully functional task management database with:**
- Complete project hierarchy
- Full audit trail of all changes  
- Rich commenting and collaboration features
- Performance tracking and analytics
- Session continuity for Claude handoffs