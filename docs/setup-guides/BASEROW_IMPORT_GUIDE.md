# 📥 Baserow Import Guide

## 📋 Table Setup Instructions

### Table 1: Tasks (Table ID: 500)
**Purpose**: Main tasks table for reference and querying

**Required Fields**:
| Field Name | Field Type | Required | Description |
|------------|------------|----------|-------------|
| `id` | Single line text | ✅ | Unique task identifier (e.g., "analytics-1") |
| `title` | Single line text | ✅ | Task title |
| `description` | Long text | ❌ | Detailed task description |
| `category` | Single line text | ✅ | Task category (e.g., "Analytics Features") |
| `agent` | Single line text | ✅ | Responsible agent (e.g., "UI-Designer") |
| `completed` | Checkbox | ✅ | Whether task is completed |
| `approved` | Checkbox | ✅ | Whether task is approved |
| `priority` | Single select | ✅ | Priority level (low, medium, high, critical) |
| `phase` | Single line text | ✅ | Project phase (e.g., "Phase 1") |
| `notes` | Long text | ❌ | Task notes or feedback |
| `lastModified` | Date | ❌ | Last modification timestamp |

### Table 2: Task Updates (Table ID: 501)  
**Purpose**: Audit trail of all task changes and updates

**Required Fields**:
| Field Name | Field Type | Required | Description |
|------------|------------|----------|-------------|
| `task_id` | Single line text | ✅ | Reference to task ID |
| `task_title` | Single line text | ✅ | Task title for context |
| `category` | Single line text | ✅ | Task category |
| `agent` | Single line text | ✅ | Responsible agent |
| `action` | Single select | ✅ | Action taken (approved, disapproved, note_added, completed, uncompleted, reset, progress_report) |
| `notes` | Long text | ❌ | Update notes or feedback |
| `priority` | Single select | ✅ | Task priority (low, medium, high, critical) |
| `phase` | Single line text | ✅ | Project phase |
| `timestamp` | Date | ✅ | When update was made |
| `status` | Single select | ✅ | Current status (pending, completed, approved) |

## 📊 Calculated Fields (Optional but Recommended)

### Tasks Table
```bash
# Add these formula fields:
- days_open: Formula → DATETIME_DIFF(NOW(), lastModified, 'days')
- is_overdue: Formula → AND(lastModified, DATETIME_DIFF(NOW(), lastModified, 'days') > 7)
```

### Task Updates Table
```bash
# Add these rollup/count fields:
- updates_count: Count of all updates for tracking activity
```

## 📤 Import Steps

### Step 1: Create Tables
1. In Baserow, create two new tables:
   - **"Tasks"** (will be table ID 500)
   - **"Task Updates"** (will be table ID 501)

### Step 2: Set Up Fields
For each table, add the fields listed above with the correct types.

**Important**: For Single Select fields, add these options:

**Priority options**: `low`, `medium`, `high`, `critical`

**Action options**: `approved`, `disapproved`, `note_added`, `completed`, `uncompleted`, `reset`, `progress_report`

**Status options**: `pending`, `completed`, `approved`

### Step 3: Import Sample Data

#### Import Tasks Table:
1. Go to your Tasks table in Baserow
2. Click the table menu (three dots) → "Import"
3. Upload `baserow_sample_tasks.json`
4. Map the JSON fields to your table columns
5. Import the data

#### Import Task Updates Table:
1. Go to your Task Updates table in Baserow
2. Click the table menu (three dots) → "Import" 
3. Upload `baserow_sample_task_updates.json`
4. Map the JSON fields to your table columns
5. Import the data

## 🔍 Sample Data Overview

### Sample Tasks (6 tasks)
- **analytics-1**: ✅ Completed & Approved - Dashboard design ready
- **analytics-2**: ✅ Completed but needs work - Chart responsiveness issues
- **dashboard-1**: ❌ Critical priority - Main dashboard layout needed
- **habits-1**: ✅ Completed & Approved - Habit creation interface done
- **calendar-2**: ❌ In progress - Calendar grid components
- **gamification-3**: ❌ Low priority - Phase 2 celebration effects

### Sample Updates (10 updates)
- **Completion updates**: When tasks were marked complete
- **Approval/disapproval updates**: Review outcomes with feedback  
- **Note updates**: Progress notes and blockers
- **Progress report**: System-generated summary

## 🎯 What This Gives You

### For Task Manager App
- ✅ **Test data** to verify Baserow integration works
- ✅ **Realistic scenarios** with approved, pending, and blocked tasks
- ✅ **Proper field validation** ensures your schema is correct

### For Future Claude Sessions
- 📊 **Complete audit trail** of all task changes
- 📝 **Context and feedback** for each task decision
- 🎯 **Priority insights** on what needs attention next
- 📈 **Progress tracking** over time

## 🧪 Testing the Integration

After importing:

1. **Test Connection**: Use the "🔗 Test Baserow Connection" button
2. **Verify Data**: Check that sample data appears correctly  
3. **Test Updates**: Try approving/disapproving tasks to see new records created
4. **Check Sync**: Ensure each action creates appropriate database entries

## 🔧 Customization

Feel free to:
- ✏️ **Modify sample data** to match your actual project needs
- ➕ **Add more tasks** from your real task manager categories
- 🏷️ **Adjust priorities** and phases to fit your workflow
- 📝 **Update notes** with your actual project context

---

**🚀 Ready to Import!**

These files will create a complete working database with realistic project data, giving you a solid foundation for task tracking and enabling future Claude sessions to understand your project's current state and priorities.