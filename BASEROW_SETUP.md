# 🔗 Baserow Integration Setup Guide

## Overview

The Habiti Task Manager now integrates with Baserow to automatically save task updates, approvals, and progress reports to a centralized database. This enables future Claude sessions to read the latest project status and continue from where previous sessions left off.

## 🛠️ Setup Instructions

### 1. Create Baserow Table

Create a new table in Baserow with the following fields:

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `task_id` | Single line text | Unique identifier for the task |
| `task_title` | Single line text | Title of the task |
| `category` | Single line text | Category the task belongs to |
| `agent` | Single line text | Agent responsible for the task |
| `action` | Single line text | Action taken (approved, disapproved, note_added, completed, reset, progress_report) |
| `notes` | Long text | Task notes or feedback |
| `priority` | Single line text | Task priority (low, medium, high, critical) |
| `phase` | Single line text | Project phase |
| `timestamp` | Date | When the update was made |
| `status` | Single line text | Current task status (pending, completed, approved) |

### 2. Configure Environment Variables

Update the environment files with your Baserow configuration:

#### Development (`src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  baserow: {
    apiUrl: 'https://api.baserow.io', // Your Baserow API URL
    token: 'your_database_token_here', // Your database token
    tables: {
      taskUpdates: 12345, // Your task updates table ID
      tasks: 0, // Optional: main tasks table ID
    }
  }
};
```

#### Production (`src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  baserow: {
    apiUrl: 'https://api.baserow.io', // Your Baserow API URL
    token: 'your_database_token_here', // Your database token
    tables: {
      taskUpdates: 12345, // Your task updates table ID
      tasks: 0, // Optional: main tasks table ID
    }
  }
};
```

### 3. Get Your Baserow Credentials

1. **API URL**: Usually `https://api.baserow.io` for Baserow.io hosted instances
2. **Database Token**: 
   - Go to your Baserow database
   - Click on "Settings" → "API tokens"
   - Create a new token with read/write permissions for your table
3. **Table ID**:
   - Go to your table
   - Check the URL: `https://baserow.io/database/xxx/table/YYYY` (YYYY is your table ID)
   - Or use the API documentation endpoint to find your table ID

## 🚀 Features

### Automatic Task Updates

The system automatically saves to Baserow when you:
- ✅ **Approve a task** - Creates record with `action: "approved"`
- ❌ **Disapprove a task** - Creates record with `action: "disapproved"`
- 📝 **Add/edit notes** - Creates record with `action: "note_added"`
- ✔️ **Complete/uncomplete a task** - Creates record with `action: "completed"` or `"uncompleted"`
- 🔄 **Reset tasks** - Creates record with `action: "reset"`
- 📊 **Bulk approve** - Creates multiple approval records + progress report

### Progress Reports

Special progress report entries are created with:
- `task_id: "PROGRESS_REPORT"`
- `action: "progress_report"`
- `notes`: Contains summary of all categories, pending high-priority tasks, and overall statistics

### Manual Actions

- **🔗 Test Baserow Connection**: Click the cyan button to verify your configuration
- **📋 Download Progress Report**: Still available for local markdown files

## 📊 Data Structure

Each update creates a record like:
```json
{
  "task_id": "analytics-1",
  "task_title": "Design analytics dashboard layout",
  "category": "Analytics Features", 
  "agent": "UI-Designer",
  "action": "approved",
  "notes": "Great work! Ready for implementation.",
  "priority": "high",
  "phase": "Phase 1",
  "timestamp": "2025-09-24T01:30:00.000Z",
  "status": "approved"
}
```

## 🔍 For Future Claude Sessions

### Reading Task Status

Future Claude agents can query Baserow to understand:
1. **Latest task statuses** - What's been completed/approved
2. **Feedback and notes** - What needs improvement
3. **Progress history** - Timeline of all changes
4. **Priority tasks** - What to focus on next

### Query Examples

```bash
# Get latest updates for all tasks
GET /api/database/rows/table/{tableId}/?order_by=-timestamp

# Get updates for specific task
GET /api/database/rows/table/{tableId}/?filter__field_task_id__equal=analytics-1

# Get latest progress reports
GET /api/database/rows/table/{tableId}/?filter__field_task_id__equal=PROGRESS_REPORT&order_by=-timestamp
```

## 🛡️ Security Notes

- Database tokens have granular permissions - only grant what's needed
- Tokens can be revoked/regenerated anytime in Baserow settings
- Consider using environment-specific tokens for dev/prod

## 🐛 Troubleshooting

### Connection Test Fails
1. Check API URL format (include https://)
2. Verify token has proper permissions
3. Confirm table ID is correct
4. Check browser console for detailed errors

### No Data Saving
1. Test connection first
2. Check browser network tab for failed requests
3. Verify table schema matches expected fields
4. Check Baserow token permissions

### Environment Not Loading
1. Restart development server after changing environment files
2. Verify file paths are correct
3. Check for TypeScript compilation errors

---

**✨ Ready to Go!**

Once configured, the task manager will automatically sync all updates to Baserow. Future Claude sessions can read this data to understand exactly where the project stands and what needs to be done next.