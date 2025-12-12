# 🤖 Claude Task Execution Automation Guide

## Overview

This guide enables automated task execution using Claude with the Habiti task management system. The system intelligently schedules and executes tasks based on priority, agent specialization, and concurrent processing capabilities.

## Quick Start Commands

```bash
# Start the complete system
cd /Users/travz/Documents/Work/habiti/habiti
npm start

# Open the queue manager in browser
open http://localhost:4200/secret-task-manager-queue

# Open task approval interface
open http://localhost:4200/secret-task-manager-x9z2k
```

## System Architecture

### 1. Task Queue Manager
- **URL**: `http://localhost:4200/secret-task-manager-queue`
- **Purpose**: Gantt-style project board with concurrent agent management
- **Features**:
  - Priority-based task scheduling
  - Concurrent agent slot management (1-9 agents)
  - Real-time progress tracking
  - Queue pause/resume controls

### 2. Approval Workflow
- **URL**: `http://localhost:4200/secret-task-manager-x9z2k` 
- **Purpose**: Human oversight and approval system
- **Features**:
  - Feature group approval/denial
  - Note-taking for feedback
  - Automated git commits on approval

## Execution Protocol

### Phase 1: Initialize System
1. Load markdown tasks: Click "Load Tasks & Create Queues"
2. Set concurrent agents: Use +/- controls (recommended: 3-5)
3. Review task priorities and agent assignments
4. Click "Start Execution" when ready

### Phase 2: Task Processing
The system will automatically:
1. **Schedule tasks** by priority (critical → high → medium → low)
2. **Assign to agents** based on specialization matching
3. **Execute concurrently** up to max agent limit
4. **Track progress** in real-time with ETA calculations

### Phase 3: Human Oversight
1. **Monitor progress** in queue manager
2. **Review completions** in approval interface
3. **Approve/deny** feature groups as needed
4. **Provide feedback** through notes system

## Agent Specializations

| Agent | Specialization | Efficiency | Best For |
|-------|---------------|------------|----------|
| 🎨 UI-Designer | Design | 2.5 tasks/hr | Visual design, UX wireframes |
| 👨‍💻 Frontend-Developer | Frontend | 3.0 tasks/hr | React components, UI logic |
| 🏗️ Backend-Architect | Backend | 2.0 tasks/hr | APIs, database design |
| 🚀 DevOps-Automator | DevOps | 1.5 tasks/hr | CI/CD, deployment |
| 🤖 AI-Engineer | AI/ML | 2.0 tasks/hr | Machine learning, AI features |
| ⚡ Performance-Benchmarker | Testing | 3.5 tasks/hr | Performance optimization |
| 📱 Mobile-App-Builder | Mobile | 2.5 tasks/hr | React Native, mobile UI |
| ✨ Whimsy-Injector | Enhancement | 4.0 tasks/hr | Delightful interactions |
| 🚀 Rapid-Prototyper | Prototyping | 5.0 tasks/hr | MVPs, proof of concepts |

## Priority System

### Task Prioritization
- **Critical**: Blockers, security issues, production bugs
- **High**: Core features, important user stories
- **Medium**: Standard features, improvements
- **Low**: Nice-to-haves, documentation, cleanup

### Automatic Scheduling
The system uses a scoring algorithm:
```
Priority Score = (Priority Weight × Agent Efficiency × Task Count)
```

Where Priority Weight:
- Critical: 4 points
- High: 3 points  
- Medium: 2 points
- Low: 1 point

## Control Commands

### Queue Management
- **Start Execution**: Begin automated task processing
- **Pause All**: Stop all running queues
- **Set Concurrency**: Adjust max simultaneous agents
- **Pause/Resume Queue**: Control individual agent queues

### Task Controls
- **Complete Task**: Simulate task completion (for testing)
- **Refresh Queues**: Reload from updated markdown files
- **Generate Script**: Export execution plan as markdown

## Monitoring & Analytics

### Real-time Metrics
- Total tasks in system
- Completion percentage
- Running/available agent slots
- ETA for current tasks

### Agent Performance
- Tasks completed per agent
- Efficiency tracking (learning system)
- Current assignments
- Historical performance

## File Integration

### Markdown File Format
Tasks are parsed from files in `src/assets/tasks/`:

```markdown
# Feature Name

### 🎨 **UI-Designer** - Component Design
- [ ] Create wireframes for dashboard ~2h
- [x] Design component library (critical)
- [ ] Implement responsive layouts

### 👨‍💻 **Frontend-Developer** - Implementation  
- [ ] Build React components ~4h
- [ ] Add state management (high priority)
- [ ] Implement routing
```

### Completion Workflow
1. **Claude marks completed**: Change `[ ]` to `[x]` in markdown
2. **System detects change**: Within 2 seconds
3. **Appears in approval UI**: For human review
4. **Human approves**: Feature group gets checkmark
5. **Auto-commits to git**: With proper formatting

## Automation Scripts

### Start Full System
```bash
#!/bin/bash
# start-habiti-automation.sh

cd /Users/travz/Documents/Work/habiti/habiti
echo "🚀 Starting Habiti Task Automation System..."

# Start Angular development server
npm start &
sleep 10

# Open queue manager
open http://localhost:4200/secret-task-manager-queue

# Open approval interface  
open http://localhost:4200/secret-task-manager-x9z2k

echo "✅ System ready for automated task execution"
echo "📋 Queue Manager: http://localhost:4200/secret-task-manager-queue"
echo "✅ Approval Interface: http://localhost:4200/secret-task-manager-x9z2k"
```

### Claude Execution Loop
For integration with Claude sessions:

```bash
# Watch for completed tasks and process approvals
while true; do
    echo "🤖 Checking for completed tasks..."
    # Your Claude integration logic here
    sleep 30
done
```

## Advanced Features

### Queue Simulation
Test the system without actual task execution:
- Use "Complete Task" buttons to simulate progress
- Observe queue behavior and scheduling
- Verify agent slot management

### Script Generation
Export current execution plan:
1. Click "Generate Claude Script"
2. Downloads markdown file with:
   - Prioritized task list
   - Agent assignments
   - Execution timeline
   - Command reference

### Performance Optimization
The system learns and adapts:
- Agent efficiency improves with completed tasks
- Queue scheduling optimizes based on performance
- Bottlenecks are automatically identified

## Troubleshooting

### Common Issues

1. **No tasks loading**
   - Check markdown files exist in `src/assets/tasks/`
   - Click "Load Tasks & Create Queues"
   - Verify file format is correct

2. **Agents not starting**  
   - Ensure "Start Execution" is clicked
   - Check max concurrent agents > 0
   - Verify queues have remaining tasks

3. **Approval not working**
   - Navigate to approval interface
   - Click "Start Sync" to initialize
   - Check browser console for errors

### Debug Mode
Enable verbose logging:
```javascript
localStorage.setItem('habiti-debug', 'true');
```

## Integration Examples

### With Claude Code
```bash
# In Claude session, mark task complete
echo "- [x] Implement user authentication system" >> tasks/backend.md

# System automatically detects change
# Appears in approval interface within 2 seconds
# Human approves via web UI
# Git commit generated automatically
```

### With CI/CD
The approval system can trigger automated deployments:
- Approved feature groups create git commits
- Git hooks can trigger build pipelines
- Staged deployments based on approval status

## Best Practices

### Task Definition
- Use specific, actionable task descriptions
- Include time estimates where possible
- Assign appropriate priority levels
- Group related tasks under same agent

### Queue Management
- Start with 2-3 concurrent agents
- Increase gradually based on capacity
- Monitor for bottlenecks
- Use pause/resume for debugging

### Approval Workflow
- Review completions regularly
- Provide detailed feedback in notes
- Approve feature groups, not individual tasks
- Use disapproval to request changes

---

## Support & Maintenance

For issues or enhancements:
1. Check browser console for errors
2. Use "Download Full Report" for system state
3. Try "Force Sync All" to refresh
4. Restart system if needed: `npm start`

The system is designed for rapid iteration and continuous improvement. Happy automating! 🚀