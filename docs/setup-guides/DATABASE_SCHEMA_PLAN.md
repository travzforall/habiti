# 🗄️ Habiti Task Management Database Schema

## 📋 Overview

This database schema is designed for comprehensive task management with full audit trails, team collaboration, and progress tracking for rapid development cycles.

## 🏗️ Table Structure & Relationships

### Core Tables

#### 1. **Categories** (Table ID: 500)
*Master list of project categories*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `name` | Single line text | ✅ | Category name (e.g., "Analytics Features") |
| `description` | Long text | ❌ | Category description |
| `color` | Single line text | ❌ | Hex color code for UI |
| `order` | Number | ❌ | Display order |
| `created_at` | Date | ✅ | Creation timestamp |
| `updated_at` | Date | ✅ | Last update timestamp |
| `status` | Single select | ✅ | active, archived, planned |

#### 2. **Agents** (Table ID: 501)
*Development agents and team members*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `name` | Single line text | ✅ | Agent name (e.g., "UI-Designer") |
| `description` | Long text | ❌ | Agent capabilities |
| `specialization` | Multiple select | ❌ | frontend, backend, design, ai, devops |
| `avatar_url` | URL | ❌ | Profile image |
| `status` | Single select | ✅ | active, busy, offline |
| `created_at` | Date | ✅ | Creation timestamp |

#### 3. **Projects** (Table ID: 502)
*High-level project organization*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `name` | Single line text | ✅ | Project name (e.g., "Habiti v2.0") |
| `description` | Long text | ❌ | Project description |
| `start_date` | Date | ❌ | Project start date |
| `target_date` | Date | ❌ | Target completion |
| `status` | Single select | ✅ | planning, active, on_hold, completed |
| `priority` | Single select | ✅ | low, medium, high, critical |
| `created_at` | Date | ✅ | Creation timestamp |
| `updated_at` | Date | ✅ | Last update timestamp |

#### 4. **Tasks** (Table ID: 503)
*Individual tasks and work items*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `task_id` | Single line text | ✅ | Unique identifier (e.g., "analytics-1") |
| `title` | Single line text | ✅ | Task title |
| `description` | Long text | ❌ | Detailed description |
| `category_id` | Link to Categories | ✅ | Links to Categories table |
| `project_id` | Link to Projects | ✅ | Links to Projects table |
| `assigned_agent_id` | Link to Agents | ❌ | Links to Agents table |
| `priority` | Single select | ✅ | low, medium, high, critical |
| `phase` | Single line text | ❌ | Development phase |
| `estimated_hours` | Number | ❌ | Estimated effort |
| `actual_hours` | Number | ❌ | Actual time spent |
| `status` | Single select | ✅ | pending, in_progress, completed, approved, blocked |
| `completed_at` | Date | ❌ | Completion timestamp |
| `approved_at` | Date | ❌ | Approval timestamp |
| `due_date` | Date | ❌ | Due date |
| `tags` | Multiple select | ❌ | bug, feature, improvement, docs |
| `dependencies` | Long text | ❌ | JSON array of dependent task IDs |
| `created_at` | Date | ✅ | Creation timestamp |
| `updated_at` | Date | ✅ | Last update timestamp |

#### 5. **Task_Updates** (Table ID: 504)
*Audit trail of all task changes*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `task_id` | Link to Tasks | ✅ | Links to Tasks table |
| `action` | Single select | ✅ | created, updated, completed, approved, disapproved, note_added, assigned, blocked, unblocked |
| `field_changed` | Single line text | ❌ | Which field was changed |
| `old_value` | Long text | ❌ | Previous value |
| `new_value` | Long text | ❌ | New value |
| `notes` | Long text | ❌ | Update notes/comments |
| `agent_id` | Link to Agents | ❌ | Who made the change |
| `timestamp` | Date | ✅ | When change occurred |
| `session_id` | Single line text | ❌ | Claude session identifier |

#### 6. **Comments** (Table ID: 505)
*Task discussions and feedback*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `task_id` | Link to Tasks | ✅ | Links to Tasks table |
| `agent_id` | Link to Agents | ❌ | Comment author |
| `parent_id` | Link to Comments | ❌ | Reply to comment (self-reference) |
| `content` | Long text | ✅ | Comment text |
| `type` | Single select | ✅ | comment, review, feedback, question |
| `is_resolved` | Checkbox | ✅ | Thread resolution status |
| `created_at` | Date | ✅ | Creation timestamp |
| `updated_at` | Date | ✅ | Last edit timestamp |

#### 7. **Milestones** (Table ID: 506)
*Project milestones and deliverables*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `project_id` | Link to Projects | ✅ | Links to Projects table |
| `title` | Single line text | ✅ | Milestone name |
| `description` | Long text | ❌ | Milestone details |
| `target_date` | Date | ✅ | Target completion date |
| `completed_date` | Date | ❌ | Actual completion date |
| `progress` | Number | ✅ | Completion percentage (0-100) |
| `status` | Single select | ✅ | upcoming, in_progress, completed, overdue |
| `created_at` | Date | ✅ | Creation timestamp |

#### 8. **Sessions** (Table ID: 507)
*Claude development sessions tracking*

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | Auto Number | ✅ | Primary key |
| `session_id` | Single line text | ✅ | Unique session identifier |
| `start_time` | Date | ✅ | Session start |
| `end_time` | Date | ❌ | Session end |
| `agent_type` | Single line text | ❌ | Claude agent type used |
| `tasks_worked` | Number | ✅ | Number of tasks touched |
| `tasks_completed` | Number | ✅ | Tasks completed in session |
| `summary` | Long text | ❌ | Session summary |
| `status` | Single select | ✅ | active, completed, interrupted |

## 🔗 Relationships

### Primary Relationships
- **Tasks → Categories**: Many-to-One (each task belongs to one category)
- **Tasks → Projects**: Many-to-One (each task belongs to one project)  
- **Tasks → Agents**: Many-to-One (each task assigned to one agent)
- **Task_Updates → Tasks**: Many-to-One (many updates per task)
- **Task_Updates → Agents**: Many-to-One (updates made by agents)
- **Comments → Tasks**: Many-to-One (many comments per task)
- **Comments → Agents**: Many-to-One (comments authored by agents)
- **Comments → Comments**: One-to-Many (comment replies, self-reference)
- **Milestones → Projects**: Many-to-One (many milestones per project)

### Lookup Fields
- **Tasks**: Category name, Project name, Agent name (via relationships)
- **Task_Updates**: Task title, Agent name (via relationships)
- **Comments**: Task title, Agent name (via relationships)

## 📊 Calculated Fields

### Tasks Table
- **Days_Open**: Formula: `DATETIME_DIFF(NOW(), created_at, 'days')`
- **Is_Overdue**: Formula: `AND(due_date, due_date < NOW(), status != 'completed')`
- **Progress_Score**: Formula: Based on status weights

### Projects Table  
- **Task_Count**: Rollup: Count of linked tasks
- **Completed_Tasks**: Rollup: Count of completed tasks
- **Completion_Rate**: Formula: `Completed_Tasks / Task_Count * 100`

### Categories Table
- **Task_Count**: Rollup: Count of linked tasks
- **Completed_Count**: Rollup: Count of completed tasks

## 🎯 Indexes and Views

### Recommended Views
1. **Active Tasks**: Tasks where status = 'pending' OR 'in_progress'
2. **Overdue Tasks**: Tasks where due_date < NOW() AND status != 'completed'
3. **Recent Updates**: Task_Updates from last 7 days, ordered by timestamp DESC
4. **Agent Workload**: Tasks grouped by assigned agent with counts
5. **Sprint View**: Tasks for current sprint/milestone
6. **Review Queue**: Tasks with status = 'completed' but not 'approved'

### Performance Indexes
- `task_id` (Tasks table) - for quick lookups
- `timestamp` (Task_Updates table) - for recent activity queries  
- `status` (Tasks table) - for filtering active/completed tasks
- `session_id` (Task_Updates, Sessions) - for session tracking

## 🔄 Data Flow

### Task Lifecycle
1. **Creation**: Task created → Task_Updates entry with action='created'
2. **Assignment**: Agent assigned → Task_Updates entry with action='assigned'  
3. **Progress**: Status updated → Task_Updates entry with action='updated'
4. **Completion**: Status = 'completed' → Task_Updates entry with action='completed'
5. **Review**: Comments added → Comments entry with type='review'
6. **Approval**: Status = 'approved' → Task_Updates entry with action='approved'

### Session Tracking
1. **Session Start**: Sessions entry created with status='active'
2. **Task Work**: Task_Updates entries include session_id
3. **Session End**: Sessions entry updated with end_time, summary, status='completed'

## 🚀 Benefits

### For Development
- **Complete audit trail** of all changes
- **Agent workload tracking** and balancing  
- **Project progress monitoring** with real-time metrics
- **Dependency management** for complex tasks
- **Session continuity** for Claude handoffs

### For Management
- **Real-time dashboards** with calculated fields
- **Performance metrics** and completion rates
- **Resource allocation** insights
- **Timeline tracking** with milestone progress
- **Quality assurance** with review workflows

This schema provides a robust foundation for managing rapid development cycles while maintaining full visibility and traceability of all work.