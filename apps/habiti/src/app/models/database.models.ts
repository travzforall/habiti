// Database Models for Habiti Task Management System

export interface Category {
  id?: number;
  name: string;
  description?: string;
  color?: string;
  order?: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived' | 'planned';
  
  // Calculated fields
  task_count?: number;
  completed_count?: number;
}

export interface Agent {
  id?: number;
  name: string;
  description?: string;
  specialization?: ('frontend' | 'backend' | 'design' | 'ai' | 'devops')[];
  avatar_url?: string;
  status: 'active' | 'busy' | 'offline';
  created_at: string;
  
  // Calculated fields
  active_tasks?: number;
  completed_tasks?: number;
}

export interface Project {
  id?: number;
  name: string;
  description?: string;
  start_date?: string;
  target_date?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  
  // Calculated fields
  task_count?: number;
  completed_tasks?: number;
  completion_rate?: number;
}

export interface Task {
  id?: number;
  task_id: string; // Unique identifier like "analytics-1"
  title: string;
  description?: string;
  category_id: number;
  project_id: number;
  assigned_agent_id?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase?: string;
  estimated_hours?: number;
  actual_hours?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'blocked';
  completed_at?: string;
  approved_at?: string;
  due_date?: string;
  tags?: ('bug' | 'feature' | 'improvement' | 'docs')[];
  dependencies?: string; // JSON array of task IDs
  created_at: string;
  updated_at: string;
  
  // Lookup fields (populated via relationships)
  category_name?: string;
  project_name?: string;
  agent_name?: string;
  
  // Calculated fields
  days_open?: number;
  is_overdue?: boolean;
  progress_score?: number;
}

export interface TaskUpdate {
  id?: number;
  task_id: number; // Links to Tasks table
  action: 'created' | 'updated' | 'completed' | 'approved' | 'disapproved' | 'note_added' | 'assigned' | 'blocked' | 'unblocked';
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  agent_id?: number;
  timestamp: string;
  session_id?: string;
  
  // Lookup fields
  task_title?: string;
  agent_name?: string;
}

export interface Comment {
  id?: number;
  task_id: number;
  agent_id?: number;
  parent_id?: number; // For reply threads
  content: string;
  type: 'comment' | 'review' | 'feedback' | 'question';
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  
  // Lookup fields
  task_title?: string;
  agent_name?: string;
  
  // For nested comments
  replies?: Comment[];
}

export interface Milestone {
  id?: number;
  project_id: number;
  title: string;
  description?: string;
  target_date: string;
  completed_date?: string;
  progress: number; // 0-100
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  created_at: string;
  
  // Lookup fields
  project_name?: string;
  
  // Related data
  tasks?: Task[];
}

export interface Session {
  id?: number;
  session_id: string;
  start_time: string;
  end_time?: string;
  agent_type?: string;
  tasks_worked: number;
  tasks_completed: number;
  summary?: string;
  status: 'active' | 'completed' | 'interrupted';
  
  // Related data
  task_updates?: TaskUpdate[];
}

// Composite interfaces for complex operations

export interface TaskWithDetails extends Task {
  category: Category;
  project: Project;
  assigned_agent?: Agent;
  updates: TaskUpdate[];
  comments: Comment[];
  milestone?: Milestone;
}

export interface ProjectDashboard extends Project {
  categories: (Category & { tasks: Task[] })[];
  milestones: Milestone[];
  agents: (Agent & { tasks: Task[] })[];
  recent_updates: TaskUpdate[];
  completion_stats: {
    total_tasks: number;
    completed_tasks: number;
    approved_tasks: number;
    blocked_tasks: number;
  };
}

export interface AgentWorkload extends Agent {
  assigned_tasks: Task[];
  recent_updates: TaskUpdate[];
  workload_stats: {
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
}

// API Response interfaces

export interface BaserowResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface BaserowError {
  error: string;
  detail?: string;
}

// Form interfaces for creating/updating

export interface CreateTaskRequest {
  task_id: string;
  title: string;
  description?: string;
  category_id: number;
  project_id: number;
  assigned_agent_id?: number;
  priority: Task['priority'];
  phase?: string;
  estimated_hours?: number;
  due_date?: string;
  tags?: Task['tags'];
  dependencies?: string[];
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: number;
  status?: Task['status'];
  actual_hours?: number;
  completed_at?: string;
  approved_at?: string;
}

export interface CreateTaskUpdateRequest {
  task_id: number;
  action: TaskUpdate['action'];
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  agent_id?: number;
  session_id?: string;
}

// Dashboard and analytics interfaces

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  approved_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  active_agents: number;
  completion_rate: number;
  velocity: number; // tasks completed per day
}

export interface CategoryStats extends Category {
  tasks: Task[];
  completion_rate: number;
  avg_completion_time: number; // in days
  blocked_count: number;
  overdue_count: number;
}

export interface TimelineEntry {
  date: string;
  type: 'task_created' | 'task_completed' | 'task_approved' | 'milestone_reached';
  title: string;
  description: string;
  task?: Task;
  milestone?: Milestone;
  agent?: Agent;
}

// Filter and search interfaces

export interface TaskFilters {
  project_id?: number;
  category_id?: number;
  agent_id?: number;
  status?: Task['status'][];
  priority?: Task['priority'][];
  tags?: string[];
  due_date_from?: string;
  due_date_to?: string;
  is_overdue?: boolean;
  search_term?: string;
}

export interface TaskSortOptions {
  field: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  direction: 'asc' | 'desc';
}

// Export interface for data management

export interface DataExport {
  export_date: string;
  export_type: 'full' | 'incremental';
  tables: {
    categories: Category[];
    agents: Agent[];
    projects: Project[];
    tasks: Task[];
    task_updates: TaskUpdate[];
    comments: Comment[];
    milestones: Milestone[];
    sessions: Session[];
  };
  metadata: {
    total_records: number;
    schema_version: string;
    exported_by: string;
  };
}