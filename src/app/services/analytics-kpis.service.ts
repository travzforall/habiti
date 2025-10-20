// Analytics KPIs and Metrics Service for Habiti Task Management
// Role: Analytics-Reporter

import { Injectable } from '@angular/core';
import { Task, Agent, Project, Category, TaskUpdate, DashboardStats } from '../models/database.models';

export interface AnalyticsKPI {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'quality' | 'efficiency' | 'performance' | 'engagement';
  formula: string;
  target?: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface MetricValue {
  kpi_id: string;
  value: number;
  calculated_at: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  metadata?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsKPIsService {

  // Core KPIs for Task Management Analytics
  private readonly CORE_KPIS: AnalyticsKPI[] = [
    
    // PRODUCTIVITY METRICS
    {
      id: 'task_completion_rate',
      name: 'Task Completion Rate',
      description: 'Percentage of tasks completed within target timeframe',
      category: 'productivity',
      formula: '(completed_tasks / total_tasks) * 100',
      target: 85,
      unit: '%'
    },
    {
      id: 'task_velocity',
      name: 'Task Velocity',
      description: 'Average number of tasks completed per day/week',
      category: 'productivity',
      formula: 'completed_tasks / time_period',
      target: 3,
      unit: 'tasks/day'
    },
    {
      id: 'sprint_burndown',
      name: 'Sprint Burndown Rate',
      description: 'Rate at which tasks are being completed in current sprint',
      category: 'productivity',
      formula: 'remaining_tasks / days_left',
      unit: 'tasks/day'
    },

    // QUALITY METRICS
    {
      id: 'task_approval_rate',
      name: 'Task Approval Rate',
      description: 'Percentage of completed tasks that get approved without rework',
      category: 'quality',
      formula: '(approved_tasks / completed_tasks) * 100',
      target: 90,
      unit: '%'
    },
    {
      id: 'rework_rate',
      name: 'Rework Rate',
      description: 'Percentage of tasks requiring additional work after completion',
      category: 'quality',
      formula: '(rework_tasks / total_completed) * 100',
      target: 10,
      unit: '%'
    },
    {
      id: 'first_time_right',
      name: 'First Time Right Rate',
      description: 'Tasks completed correctly on first attempt',
      category: 'quality',
      formula: '(approved_without_rework / completed_tasks) * 100',
      target: 85,
      unit: '%'
    },

    // EFFICIENCY METRICS
    {
      id: 'avg_task_completion_time',
      name: 'Average Task Completion Time',
      description: 'Mean time from task start to completion',
      category: 'efficiency',
      formula: 'sum(completion_times) / total_completed_tasks',
      target: 2.5,
      unit: 'days'
    },
    {
      id: 'time_estimation_accuracy',
      name: 'Time Estimation Accuracy',
      description: 'How close actual time matches estimated time',
      category: 'efficiency',
      formula: '100 - abs((actual_hours - estimated_hours) / estimated_hours * 100)',
      target: 80,
      unit: '%'
    },
    {
      id: 'blocked_time_ratio',
      name: 'Blocked Time Ratio',
      description: 'Percentage of time tasks spend in blocked status',
      category: 'efficiency',
      formula: '(blocked_time / total_active_time) * 100',
      target: 5,
      unit: '%'
    },

    // PERFORMANCE METRICS
    {
      id: 'agent_utilization',
      name: 'Agent Utilization Rate',
      description: 'Percentage of time agents are actively working on tasks',
      category: 'performance',
      formula: '(active_work_time / available_time) * 100',
      target: 75,
      unit: '%'
    },
    {
      id: 'priority_adherence',
      name: 'Priority Adherence Rate',
      description: 'How often high-priority tasks are completed first',
      category: 'performance',
      formula: '(high_priority_completed_on_time / total_high_priority) * 100',
      target: 95,
      unit: '%'
    },
    {
      id: 'deadline_compliance',
      name: 'Deadline Compliance Rate',
      description: 'Percentage of tasks completed by their due date',
      category: 'performance',
      formula: '(on_time_completions / tasks_with_deadlines) * 100',
      target: 90,
      unit: '%'
    },

    // ENGAGEMENT METRICS
    {
      id: 'comment_engagement',
      name: 'Comment Engagement Rate',
      description: 'Average comments per task indicating collaboration',
      category: 'engagement',
      formula: 'total_comments / total_tasks',
      target: 2,
      unit: 'comments/task'
    },
    {
      id: 'update_frequency',
      name: 'Update Frequency',
      description: 'How often tasks receive status updates',
      category: 'engagement',
      formula: 'total_updates / total_active_tasks',
      target: 5,
      unit: 'updates/task'
    },
    {
      id: 'cross_agent_collaboration',
      name: 'Cross-Agent Collaboration',
      description: 'Tasks involving multiple agents',
      category: 'engagement',
      formula: '(multi_agent_tasks / total_tasks) * 100',
      target: 30,
      unit: '%'
    }
  ];

  // Key Metrics Cards for Dashboard
  public getKeyMetricsCards(): AnalyticsKPI[] {
    return [
      this.getKPIById('task_completion_rate'),
      this.getKPIById('task_velocity'),
      this.getKPIById('task_approval_rate'),
      this.getKPIById('avg_task_completion_time'),
      this.getKPIById('agent_utilization'),
      this.getKPIById('deadline_compliance')
    ].filter(kpi => kpi !== null) as AnalyticsKPI[];
  }

  // Get KPI by ID
  public getKPIById(id: string): AnalyticsKPI | null {
    return this.CORE_KPIS.find(kpi => kpi.id === id) || null;
  }

  // Get KPIs by category
  public getKPIsByCategory(category: AnalyticsKPI['category']): AnalyticsKPI[] {
    return this.CORE_KPIS.filter(kpi => kpi.category === category);
  }

  // Calculate Task Completion Rate
  public calculateTaskCompletionRate(tasks: Task[]): MetricValue {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    
    return {
      kpi_id: 'task_completion_rate',
      value: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { totalTasks, completedTasks }
    };
  }

  // Calculate Task Velocity (daily)
  public calculateTaskVelocity(tasks: Task[], periodDays: number = 7): MetricValue {
    const now = new Date();
    const periodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    
    const completedInPeriod = tasks.filter(t => 
      t.completed_at && new Date(t.completed_at) >= periodStart
    ).length;

    return {
      kpi_id: 'task_velocity',
      value: Math.round((completedInPeriod / periodDays) * 10) / 10,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { completedInPeriod, periodDays }
    };
  }

  // Calculate Task Approval Rate
  public calculateTaskApprovalRate(tasks: Task[]): MetricValue {
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved');
    const approvedTasks = tasks.filter(t => t.status === 'approved');
    
    return {
      kpi_id: 'task_approval_rate',
      value: completedTasks.length > 0 ? Math.round((approvedTasks.length / completedTasks.length) * 100) : 0,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { completedTasks: completedTasks.length, approvedTasks: approvedTasks.length }
    };
  }

  // Calculate Average Task Completion Time
  public calculateAvgCompletionTime(tasks: Task[]): MetricValue {
    const completedTasks = tasks.filter(t => t.completed_at && t.created_at);
    
    if (completedTasks.length === 0) {
      return {
        kpi_id: 'avg_task_completion_time',
        value: 0,
        calculated_at: new Date().toISOString(),
        period: 'daily',
        metadata: { completedTasks: 0 }
      };
    }

    const totalDays = completedTasks.reduce((sum, task) => {
      const created = new Date(task.created_at);
      const completed = new Date(task.completed_at!);
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return {
      kpi_id: 'avg_task_completion_time',
      value: Math.round((totalDays / completedTasks.length) * 10) / 10,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { completedTasks: completedTasks.length, totalDays }
    };
  }

  // Calculate Agent Utilization
  public calculateAgentUtilization(agents: Agent[], tasks: Task[]): MetricValue {
    const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'busy');
    const busyAgents = agents.filter(a => a.status === 'busy');
    
    return {
      kpi_id: 'agent_utilization',
      value: activeAgents.length > 0 ? Math.round((busyAgents.length / activeAgents.length) * 100) : 0,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { activeAgents: activeAgents.length, busyAgents: busyAgents.length }
    };
  }

  // Calculate Deadline Compliance Rate
  public calculateDeadlineCompliance(tasks: Task[]): MetricValue {
    const tasksWithDeadlines = tasks.filter(t => t.due_date && (t.status === 'completed' || t.status === 'approved'));
    const onTimeCompletions = tasksWithDeadlines.filter(t => {
      if (!t.completed_at) return false;
      return new Date(t.completed_at) <= new Date(t.due_date!);
    });

    return {
      kpi_id: 'deadline_compliance',
      value: tasksWithDeadlines.length > 0 ? 
        Math.round((onTimeCompletions.length / tasksWithDeadlines.length) * 100) : 0,
      calculated_at: new Date().toISOString(),
      period: 'daily',
      metadata: { 
        tasksWithDeadlines: tasksWithDeadlines.length, 
        onTimeCompletions: onTimeCompletions.length 
      }
    };
  }

  // Generate comprehensive dashboard stats
  public generateDashboardStats(
    tasks: Task[], 
    agents: Agent[], 
    projects: Project[], 
    categories: Category[]
  ): DashboardStats & { kpis: MetricValue[] } {
    
    const baseStats: DashboardStats = {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'active').length,
      total_tasks: tasks.length,
      completed_tasks: tasks.filter(t => t.status === 'completed' || t.status === 'approved').length,
      approved_tasks: tasks.filter(t => t.status === 'approved').length,
      blocked_tasks: tasks.filter(t => t.status === 'blocked').length,
      overdue_tasks: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length,
      active_agents: agents.filter(a => a.status === 'active' || a.status === 'busy').length,
      completion_rate: 0,
      velocity: 0
    };

    // Calculate completion rate and velocity
    const completionRateKPI = this.calculateTaskCompletionRate(tasks);
    const velocityKPI = this.calculateTaskVelocity(tasks);
    
    baseStats.completion_rate = completionRateKPI.value;
    baseStats.velocity = velocityKPI.value;

    // Calculate all key KPIs
    const kpis: MetricValue[] = [
      completionRateKPI,
      velocityKPI,
      this.calculateTaskApprovalRate(tasks),
      this.calculateAvgCompletionTime(tasks),
      this.calculateAgentUtilization(agents, tasks),
      this.calculateDeadlineCompliance(tasks)
    ];

    return { ...baseStats, kpis };
  }

  // Get all available KPIs
  public getAllKPIs(): AnalyticsKPI[] {
    return [...this.CORE_KPIS];
  }

  // Validate KPI targets and thresholds
  public validateKPIPerformance(metric: MetricValue): 'excellent' | 'good' | 'warning' | 'critical' {
    const kpi = this.getKPIById(metric.kpi_id);
    if (!kpi || !kpi.target) return 'good';

    const performance = metric.value / kpi.target;
    
    if (performance >= 1.0) return 'excellent';
    if (performance >= 0.8) return 'good';
    if (performance >= 0.6) return 'warning';
    return 'critical';
  }
}