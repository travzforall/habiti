export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
  assignee?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  dependencies?: string[]; // Task IDs this task depends on
  subtasks?: Task[];
  attachments?: Attachment[];
  comments?: Comment[];
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  targetDate: Date;
  completed: boolean;
  completedAt?: Date;
  tasks: string[]; // Task IDs associated with this milestone
  progress: number; // 0-100 percentage
}

export interface Goal {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string; // e.g., "tasks", "hours", "%"
  deadline?: Date;
  achieved: boolean;
  achievedAt?: Date;
  category?: 'quality' | 'productivity' | 'learning' | 'deadline' | 'other';
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  owner?: string;
  team?: string[];
  tasks: Task[];
  milestones: Milestone[];
  goals: Goal[];
  tags?: string[];
  color?: string;
  icon?: string;
  progress: number; // Overall progress 0-100
  budget?: {
    estimated: number;
    spent: number;
    currency: string;
  };
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface Comment {
  id: string;
  text: string;
  author?: string;
  createdAt: Date;
  editedAt?: Date;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
  totalMilestones: number;
  completedMilestones: number;
  totalGoals: number;
  achievedGoals: number;
  averageTaskCompletionTime: number; // in hours
  productivity: number; // 0-100 score
}