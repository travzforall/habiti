# Project Management & Goals System

## Requirements Summary

### 1. Multi-Type Goal Management
- **Personal Goals**: Health, education, relationships, hobbies, personal growth
- **Business Goals**: Revenue targets, product launches, team growth, market expansion
- **Multi-Business Support**: Manage goals for different businesses/projects separately
- **Goal Hierarchy**: Long-term vision → Annual goals → Quarterly objectives → Monthly milestones → Weekly targets

### 2. Task Management System
- **Task Creation & Assignment**: Create tasks linked to specific goals
- **Priority Levels**: Urgent/Important matrix (Eisenhower)
- **Dependencies**: Task chains and prerequisites
- **Time Tracking**: Estimate vs actual time spent
- **Subtasks**: Break down complex tasks into manageable pieces
- **Recurring Tasks**: Daily, weekly, monthly templates

### 3. Project Organization
- **Project Workspaces**: Separate spaces for different businesses/areas
- **Team Collaboration**: Share projects and assign tasks (future phase)
- **Templates**: Reusable project and goal templates
- **Tags & Categories**: Flexible organization system

## Feature List

### Goal Management Features
- **Goal Types**: Personal, Business, Financial, Learning, Health, Creative
- **SMART Goals**: Specific, Measurable, Achievable, Relevant, Time-bound
- **Goal Metrics**: Custom KPIs and success criteria
- **Progress Tracking**: Visual progress bars and milestone checkpoints
- **Goal Dependencies**: Link related goals and sub-goals
- **Goal Templates**: Pre-built templates for common objectives
- **Vision Board**: Visual representation of long-term goals
- **Goal Review**: Regular review prompts and reflection

### Task Management Features
- **Task Board**: Kanban-style board with customizable columns
- **List View**: Traditional task list with filters and sorting
- **Calendar Integration**: Tasks appear on calendar with deadlines
- **Priority Matrix**: 2x2 grid for urgent/important classification
- **Time Blocking**: Allocate specific time slots for tasks
- **Task Dependencies**: Show which tasks block others
- **Batch Operations**: Multi-select for bulk actions
- **Quick Add**: Rapid task creation with natural language
- **Task Templates**: Reusable task structures
- **Attachments**: Add files, links, notes to tasks

### Project Features
- **Project Dashboard**: Overview of all active projects
- **Project Timeline**: Gantt chart view of project phases
- **Resource Planning**: Track time and resource allocation
- **Project Templates**: Standard project structures
- **Milestone Tracking**: Key deliverables and checkpoints
- **Project Health**: Status indicators and risk assessment
- **Budget Tracking**: Financial planning and tracking
- **Project Archive**: Completed project history

### Business Management Features
- **Business Profiles**: Separate workspaces for each business
- **Business Metrics**: Revenue, growth, customer metrics
- **OKRs**: Objectives and Key Results framework
- **SWOT Analysis**: Strengths, Weaknesses, Opportunities, Threats
- **Competitor Tracking**: Monitor competitive landscape
- **Market Goals**: Market share, expansion targets
- **Team Goals**: Hiring, training, culture objectives
- **Product Roadmap**: Feature planning and releases

## Task List

### Phase 1: Core Data Models & Infrastructure
- [ ] Create project/goal/task data models and interfaces
- [ ] Implement project workspace management
- [ ] Build basic CRUD operations for goals and tasks
- [ ] Set up localStorage persistence for project data
- [ ] Create project/business switching mechanism
- [ ] Implement goal hierarchy (vision → annual → quarterly → monthly)

### Phase 2: Goal Management System
- [ ] Build goal creation wizard with SMART criteria
- [ ] Implement goal types and categorization
- [ ] Create goal progress tracking and metrics
- [ ] Add goal templates library
- [ ] Build vision board interface
- [ ] Implement goal dependencies and relationships
- [ ] Add goal review and reflection system

### Phase 3: Task Management System
- [ ] Create Kanban board component
- [ ] Implement task CRUD operations
- [ ] Add drag-and-drop functionality
- [ ] Build priority matrix view
- [ ] Implement task dependencies
- [ ] Add time tracking features
- [ ] Create recurring task system
- [ ] Build quick-add task functionality

### Phase 4: Project Organization
- [ ] Design project dashboard
- [ ] Create project timeline/Gantt view
- [ ] Implement milestone tracking
- [ ] Add project templates
- [ ] Build project health indicators
- [ ] Create project archiving system

### Phase 5: Business Features
- [ ] Create business profile management
- [ ] Implement OKR framework
- [ ] Add business metrics dashboard
- [ ] Build competitor tracking
- [ ] Create product roadmap view
- [ ] Implement team goal management

### Phase 6: Integration & Analytics
- [ ] Integrate with existing habit system
- [ ] Connect to calendar for deadlines
- [ ] Link to Pomodoro timer for task execution
- [ ] Create comprehensive analytics dashboard
- [ ] Build reporting and export features
- [ ] Add notification system for deadlines

## Technical Specifications

### Data Models
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  type: 'personal' | 'business';
  businessId?: string; // For business projects
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'archived';
  startDate: Date;
  endDate?: Date;
  color: string;
  icon: string;
  goals: string[]; // Goal IDs
  tasks: string[]; // Task IDs
  milestones: Milestone[];
  budget?: number;
  spent?: number;
  team?: string[]; // User IDs for future collaboration
  createdAt: Date;
  updatedAt: Date;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'personal' | 'business' | 'financial' | 'learning' | 'health' | 'creative';
  category: string;
  projectId?: string;
  businessId?: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'long-term';
  startDate: Date;
  deadline: Date;
  metrics: GoalMetric[];
  progress: number; // 0-100
  status: 'not-started' | 'in-progress' | 'at-risk' | 'completed' | 'abandoned';
  priority: 'low' | 'medium' | 'high' | 'critical';
  parentGoalId?: string; // For sub-goals
  childGoalIds: string[];
  taskIds: string[]; // Related tasks
  smart: {
    specific: string;
    measurable: string;
    achievable: string;
    relevant: string;
    timeBound: string;
  };
  reflection?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  goalId?: string;
  businessId?: string;
  status: 'todo' | 'in-progress' | 'blocked' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  importance: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string; // User ID for future collaboration
  dueDate?: Date;
  estimatedTime?: number; // in minutes
  actualTime?: number; // in minutes
  tags: string[];
  dependencies: string[]; // Task IDs that must complete first
  blockedBy?: string[]; // Task IDs that are blocking this
  subtasks: Subtask[];
  attachments: Attachment[];
  recurrence?: RecurrencePattern;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Business {
  id: string;
  name: string;
  type: 'startup' | 'small-business' | 'enterprise' | 'freelance' | 'side-project';
  industry: string;
  description: string;
  logo?: string;
  website?: string;
  foundedDate?: Date;
  metrics: BusinessMetrics;
  team: TeamMember[];
  competitors: Competitor[];
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  okrs: OKR[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface GoalMetric {
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  trackingFrequency: 'daily' | 'weekly' | 'monthly';
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'missed';
  completedAt?: Date;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: Date;
}

interface Attachment {
  id: string;
  type: 'file' | 'link' | 'note';
  name: string;
  url?: string;
  content?: string;
  addedAt: Date;
}

interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // Every N days/weeks/months
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  endDate?: Date;
  maxOccurrences?: number;
}

interface BusinessMetrics {
  revenue: {
    monthly: number;
    annual: number;
    growth: number; // percentage
  };
  customers: {
    total: number;
    active: number;
    churnRate: number;
  };
  team: {
    size: number;
    satisfaction: number; // 1-10
  };
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email?: string;
  joinedAt: Date;
}

interface Competitor {
  id: string;
  name: string;
  website?: string;
  strengths: string[];
  weaknesses: string[];
}

interface OKR {
  id: string;
  objective: string;
  quarter: string; // "Q1 2024"
  keyResults: KeyResult[];
  progress: number; // 0-100
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
}

interface KeyResult {
  id: string;
  description: string;
  target: number;
  current: number;
  unit: string;
}
```

### UI Components
- **ProjectSelector**: Dropdown to switch between projects/businesses
- **GoalWizard**: Step-by-step goal creation with SMART criteria
- **TaskBoard**: Kanban board with drag-and-drop
- **PriorityMatrix**: 2x2 grid for task prioritization
- **GoalTree**: Hierarchical view of goals and sub-goals
- **ProgressRing**: Circular progress indicator for goals
- **Timeline**: Gantt chart for project visualization
- **MetricCard**: Display KPI metrics with trends
- **VisionBoard**: Visual goal collage/mood board
- **BusinessDashboard**: Overview of business metrics and OKRs
- **TaskQuickAdd**: Natural language task input
- **GoalReview**: Periodic goal reflection interface

### Views & Pages
- **Dashboard**: Overview of all projects, goals, and tasks
- **Projects View**: List/grid of all projects
- **Goals View**: Hierarchical goal browser
- **Tasks View**: Kanban/list/calendar views of tasks
- **Timeline View**: Gantt chart of projects and milestones
- **Analytics View**: Progress charts and insights
- **Business View**: Business-specific dashboard
- **Planning View**: Goal planning and vision board
- **Review View**: Reflection and adjustment interface

## Success Criteria
- Users can manage multiple personal and business goals simultaneously
- Clear separation between different businesses/projects
- Task dependencies prevent blocking situations
- Goals cascade properly from annual to daily targets
- Progress tracking provides actionable insights
- Integration with habits creates unified productivity system
- Business metrics help track company growth
- Templates speed up project/goal creation
- Mobile-responsive for on-the-go management

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Basic data models and storage
- Simple goal and task CRUD
- Project workspace switching

### Phase 2: Goal System (Weeks 3-4)
- SMART goal creation
- Goal hierarchy and dependencies
- Progress tracking and metrics

### Phase 3: Task Management (Weeks 5-6)
- Kanban board implementation
- Task dependencies and priorities
- Time tracking and estimates

### Phase 4: Business Features (Weeks 7-8)
- Business profiles and metrics
- OKR implementation
- Multi-business support

### Phase 5: Integration (Weeks 9-10)
- Connect with habit tracker
- Calendar integration
- Pomodoro timer linking

### Phase 6: Polish & Analytics (Weeks 11-12)
- Analytics dashboard
- Templates and quick-add
- Performance optimization

## Integration Points

### With Habit Tracker
- Link habits to personal goals
- Track habit completion as goal metrics
- Use habit streaks for goal motivation

### With Calendar
- Show task deadlines and milestones
- Time block for focused work
- Schedule goal review sessions

### With Pomodoro Timer
- Start timer directly from tasks
- Track actual time spent
- Focus sessions for deep work

### With Nightly Planner
- Review daily task progress
- Plan tomorrow's priority tasks
- Reflect on goal advancement

## Design Considerations
- **Flexibility**: Support various goal-setting methodologies
- **Scalability**: Handle hundreds of tasks efficiently
- **Privacy**: Separate personal and business data
- **Collaboration**: Future-proof for team features
- **Mobile-first**: Responsive design for all devices
- **Offline**: Work without internet connection
- **Export**: CSV/JSON export for backup/migration