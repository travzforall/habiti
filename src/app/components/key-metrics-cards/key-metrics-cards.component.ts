// Key Metrics Cards Component for Analytics Dashboard
// Role: Analytics-Reporter

import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsKPIsService, AnalyticsKPI, MetricValue } from '../../services/analytics-kpis.service';
import { Task, Agent, Project, Category } from '../../models/database.models';

interface MetricCardData {
  kpi: AnalyticsKPI;
  value: MetricValue;
  performance: 'excellent' | 'good' | 'warning' | 'critical';
  change?: number;
  changeDirection?: 'up' | 'down' | 'stable';
}

@Component({
  selector: 'app-key-metrics-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './key-metrics-cards.component.html',
  styleUrls: ['./key-metrics-cards.component.css']
})
export class KeyMetricsCardsComponent implements OnInit {
  @Input() tasks: Task[] = [];
  @Input() agents: Agent[] = [];
  @Input() projects: Project[] = [];
  @Input() categories: Category[] = [];
  @Input() compact: boolean = false;

  metricsData: MetricCardData[] = [];
  isLoading: boolean = true;

  constructor(private analyticsService: AnalyticsKPIsService) {}

  ngOnInit(): void {
    this.calculateMetrics();
  }

  ngOnChanges(): void {
    this.calculateMetrics();
  }

  private calculateMetrics(): void {
    this.isLoading = true;
    
    const keyKPIs = this.analyticsService.getKeyMetricsCards();
    this.metricsData = [];

    keyKPIs.forEach(kpi => {
      let metricValue: MetricValue;

      switch (kpi.id) {
        case 'task_completion_rate':
          metricValue = this.analyticsService.calculateTaskCompletionRate(this.tasks);
          break;
        case 'task_velocity':
          metricValue = this.analyticsService.calculateTaskVelocity(this.tasks);
          break;
        case 'task_approval_rate':
          metricValue = this.analyticsService.calculateTaskApprovalRate(this.tasks);
          break;
        case 'avg_task_completion_time':
          metricValue = this.analyticsService.calculateAvgCompletionTime(this.tasks);
          break;
        case 'agent_utilization':
          metricValue = this.analyticsService.calculateAgentUtilization(this.agents, this.tasks);
          break;
        case 'deadline_compliance':
          metricValue = this.analyticsService.calculateDeadlineCompliance(this.tasks);
          break;
        default:
          return;
      }

      const performance = this.analyticsService.validateKPIPerformance(metricValue);
      
      this.metricsData.push({
        kpi,
        value: metricValue,
        performance,
        change: this.calculateTrendChange(kpi.id),
        changeDirection: this.getTrendDirection(kpi.id)
      });
    });

    this.isLoading = false;
  }

  private calculateTrendChange(kpiId: string): number {
    // Mock trend calculation - in real implementation would compare with historical data
    const mockChanges: Record<string, number> = {
      'task_completion_rate': 5.2,
      'task_velocity': -0.3,
      'task_approval_rate': 2.1,
      'avg_task_completion_time': -0.5,
      'agent_utilization': 8.7,
      'deadline_compliance': -1.2
    };
    return mockChanges[kpiId] || 0;
  }

  private getTrendDirection(kpiId: string): 'up' | 'down' | 'stable' {
    const change = this.calculateTrendChange(kpiId);
    if (Math.abs(change) < 0.5) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  getPerformanceClass(performance: string): string {
    const classes = {
      'excellent': 'performance-excellent',
      'good': 'performance-good',
      'warning': 'performance-warning',
      'critical': 'performance-critical'
    };
    return classes[performance as keyof typeof classes] || 'performance-good';
  }

  getTrendClass(direction: string): string {
    const classes = {
      'up': 'trend-up',
      'down': 'trend-down',
      'stable': 'trend-stable'
    };
    return classes[direction as keyof typeof classes] || 'trend-stable';
  }

  getTrendIcon(direction: string): string {
    const icons = {
      'up': '↗️',
      'down': '↘️',
      'stable': '→'
    };
    return icons[direction as keyof typeof icons] || '→';
  }

  getFormattedValue(metric: MetricValue, unit: string): string {
    const value = metric.value;
    
    if (unit === '%') {
      return `${value}%`;
    } else if (unit === 'days') {
      return `${value}d`;
    } else if (unit === 'tasks/day') {
      return `${value}/day`;
    } else if (unit === 'comments/task') {
      return `${value} comments`;
    }
    
    return `${value} ${unit}`;
  }

  refreshMetrics(): void {
    this.calculateMetrics();
  }

  getCompactLayout(): boolean {
    return this.compact || window.innerWidth < 768;
  }

  getCategoryIcon(category: string): string {
    const icons = {
      'productivity': '📈',
      'quality': '✅',
      'efficiency': '⚡',
      'performance': '🎯',
      'engagement': '💬'
    };
    return icons[category as keyof typeof icons] || '📊';
  }

  getPerformanceLabel(performance: string): string {
    const labels = {
      'excellent': 'Excellent',
      'good': 'Good',
      'warning': 'Needs Attention',
      'critical': 'Critical'
    };
    return labels[performance as keyof typeof labels] || 'Good';
  }

  getMetadataItems(metadata: any): { key: string; value: any }[] {
    return Object.entries(metadata).map(([key, value]) => ({ key, value }));
  }

  getFormattedTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString();
  }

  getCurrentTime(): string {
    return new Date().toISOString();
  }

  getExcellentCount(): number {
    return this.metricsData.filter(m => m.performance === 'excellent').length;
  }

  getGoodCount(): number {
    return this.metricsData.filter(m => m.performance === 'good').length;
  }

  getWarningCount(): number {
    return this.metricsData.filter(m => m.performance === 'warning').length;
  }

  getCriticalCount(): number {
    return this.metricsData.filter(m => m.performance === 'critical').length;
  }

  Math = Math;
}