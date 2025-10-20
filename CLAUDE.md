# 🤖 Claude Session Instructions

## Auto-Initialization Commands

**Every Claude session should start by running these commands:**

```bash
# Navigate to project directory
cd /Users/travz/Documents/Work/habiti/habiti

# Check system status
npm start &
sleep 5

# Access task database and instructions
curl -s http://localhost:4200/assets/tasks/ | grep -o 'href="[^"]*\.md"' | head -10
```

## Database Connection & Task Retrieval

### 1. Connect to Baserow Database
```javascript
// Use the MCP connection to scan the database
// Database URL: https://db.jollycares.com
// Tables: tasks (508), taskUpdates (509), agents (506), projects (507)
```

### 2. Task Source Locations
- **Primary Source**: Baserow database tables
- **Local Cache**: `/Users/travz/Documents/Work/habiti/habiti/src/assets/tasks/*.md`
- **Queue Manager**: `http://localhost:4200/secret-task-manager-queue`
- **Approval System**: `http://localhost:4200/secret-task-manager-x9z2k`

## Session Startup Protocol

### Step 1: System Check
```bash
# Verify system is running
curl -s http://localhost:4200/secret-task-manager-queue >/dev/null && echo "✅ System Online" || echo "❌ System Offline"
```

### Step 2: Load Current Tasks
```bash
# Access the queue manager to see current task status
open http://localhost:4200/secret-task-manager-queue
```

### Step 3: Check for Instructions
- **Check database** for new task assignments
- **Review priority queue** for next tasks to execute
- **Verify agent assignments** match your capabilities

## Task Execution Workflow

### 1. **Get Tasks from Database**
Use MCP Baserow connection to:
- List current pending tasks
- Check task priorities and assignments
- Identify which agent role to assume

### 2. **Load Specific Task Lists**
Access markdown files for detailed task descriptions:
- `analytics.md` - Analytics & reporting tasks
- `dashboard.md` - Dashboard UI components
- `calendar.md` - Calendar functionality
- `gamification.md` - Gamification features
- `habits.md` - Habit tracking system
- `planner.md` - Planning tools
- `pomodoro.md` - Pomodoro timer features
- `project-management.md` - PM tools
- `misc.md` - Miscellaneous tasks

### 3. **Execute Tasks**
For each assigned task:
1. **Mark as started** in database
2. **Complete the work** according to specifications
3. **Mark as completed** with `[x]` in markdown
4. **Update database** with completion status
5. **Wait for approval** via human oversight

## Agent Role Assignment

Based on task type, assume the appropriate agent persona:

- **🎨 UI-Designer**: Visual design, wireframes, user experience
- **👨‍💻 Frontend-Developer**: React components, JavaScript, CSS
- **🏗️ Backend-Architect**: APIs, databases, server architecture  
- **🚀 DevOps-Automator**: CI/CD, deployment, infrastructure
- **🤖 AI-Engineer**: Machine learning, AI features
- **⚡ Performance-Benchmarker**: Optimization, testing
- **📱 Mobile-App-Builder**: React Native, mobile interfaces
- **✨ Whimsy-Injector**: Delightful interactions, animations
- **🚀 Rapid-Prototyper**: Quick prototypes, MVPs

## Database Schema Reference

### Tasks Table (ID: 508)
- `title`: Task name
- `description`: Detailed description
- `status`: pending/in_progress/completed/approved
- `priority`: low/medium/high/critical
- `assigned_agent_id`: Link to agent
- `category_id`: Link to category
- `estimated_hours`: Time estimate
- `actual_hours`: Time spent
- `due_date`: Deadline
- `dependencies`: Related tasks

### Task Updates Table (ID: 509)
- `task_id`: Reference to task
- `action`: created/updated/completed/approved
- `agent_id`: Who made the change
- `timestamp`: When it happened
- `notes`: Additional information
- `old_value`/`new_value`: Change details

## Automatic Status Updates

When working on tasks, automatically:
1. **Create task update record** when starting
2. **Update progress** periodically  
3. **Log completion** when finished
4. **Request approval** from human oversight

## Error Handling & Fallbacks

If database is unavailable:
1. **Fall back to local markdown files**
2. **Use offline task list**
3. **Queue updates for when database returns**
4. **Continue with cached priorities**

## Human Oversight Integration

All completed work requires approval:
1. **Mark tasks complete** in markdown with `[x]`
2. **System auto-detects** changes within 2 seconds
3. **Appears in approval interface** for human review
4. **Human approves/denies** with optional notes
5. **Git commits generated** only after approval

## Session Commands Reference

### Quick Database Check
```javascript
// Check database connection
mcp__Baserow_MCP__list_tables

// Get current tasks
mcp__Baserow_MCP__list_table_rows({ table_id: 508 })

// Get task updates
mcp__Baserow_MCP__list_table_rows({ table_id: 509 })
```

### Task Management
```bash
# Open queue manager
open http://localhost:4200/secret-task-manager-queue

# Open approval system
open http://localhost:4200/secret-task-manager-x9z2k

# Check task files
ls src/assets/tasks/
```

### Emergency Procedures
If systems are down:
1. **Check background processes**: `ps aux | grep npm`
2. **Restart system**: `./start-automation.sh`
3. **Use fallback**: Access `http://localhost:4200/legacy-task-manager`
4. **Manual sync**: Run `Force Sync All` in interface

## Performance Expectations

- **Response time**: Acknowledge instructions within 30 seconds
- **Task completion**: Update progress every 15-30 minutes
- **Status updates**: Mark completion immediately
- **Error reporting**: Report issues within 5 minutes

## Integration Points

### With Git
- All approved changes create git commits
- Commit messages include task details
- Branch workflow supported
- History preserved for auditing

### With Development Server
- Hot reload for immediate testing
- Live preview of changes
- Automatic asset serving
- Real-time sync monitoring

### With Human Oversight
- Never bypass approval requirements
- Provide detailed completion notes
- Request clarification when needed
- Report blocking issues immediately

---

## Quick Start Checklist

Every session should verify:
- [ ] System is running (`npm start`)
- [ ] Database connection works (MCP tools)
- [ ] Task queue is accessible
- [ ] Current agent role is clear
- [ ] Priority tasks are identified
- [ ] Approval system is ready

**Remember**: This system is designed for rapid iteration with human oversight. Complete tasks efficiently but always wait for approval before considering work truly finished.

🚀 **Ready to start automated task execution!**