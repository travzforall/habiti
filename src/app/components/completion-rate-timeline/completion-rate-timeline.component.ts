// Completion Rate Timeline Chart Component
// Role: Analytics-Reporter

import { Component, OnInit, Input, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskUpdate } from '../../models/database.models';

interface TimelineDataPoint {
  date: string;
  completionRate: number;
  completedTasks: number;
  totalTasks: number;
  period: 'daily' | 'weekly' | 'monthly';
}

interface ChartConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  showGrid: boolean;
  showTooltip: boolean;
  timeRange: '7d' | '30d' | '90d' | '1y';
}

@Component({
  selector: 'app-completion-rate-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './completion-rate-timeline.component.html',
  styleUrls: ['./completion-rate-timeline.component.css']
})
export class CompletionRateTimelineComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLDivElement>;
  
  @Input() tasks: Task[] = [];
  @Input() taskUpdates: TaskUpdate[] = [];
  @Input() height: number = 300;
  @Input() showControls: boolean = true;
  
  timelineData: TimelineDataPoint[] = [];
  chartConfig: ChartConfig = {
    width: 800,
    height: 300,
    margin: { top: 20, right: 30, bottom: 40, left: 50 },
    showGrid: true,
    showTooltip: true,
    timeRange: '30d'
  };
  
  isLoading: boolean = true;
  selectedTimeRange: string = '30d';
  selectedPeriod: 'daily' | 'weekly' | 'monthly' = 'daily';
  hoveredPoint: TimelineDataPoint | null = null;
  tooltipPosition = { x: 0, y: 0 };

  ngOnInit(): void {
    this.chartConfig.height = this.height;
    this.generateTimelineData();
  }

  ngAfterViewInit(): void {
    this.initializeChart();
    this.drawChart();
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  private generateTimelineData(): void {
    this.isLoading = true;
    
    const now = new Date();
    const timeRanges = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const days = timeRanges[this.chartConfig.timeRange as keyof typeof timeRanges];
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    this.timelineData = [];
    
    // Generate data points based on selected period
    if (this.selectedPeriod === 'daily') {
      this.generateDailyData(startDate, now);
    } else if (this.selectedPeriod === 'weekly') {
      this.generateWeeklyData(startDate, now);
    } else {
      this.generateMonthlyData(startDate, now);
    }
    
    this.isLoading = false;
  }

  private generateDailyData(startDate: Date, endDate: Date): void {
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Count tasks created by this date
      const tasksCreatedByDate = this.tasks.filter(task => 
        new Date(task.created_at) <= dayEnd
      );
      
      // Count tasks completed by this date
      const tasksCompletedByDate = tasksCreatedByDate.filter(task => 
        task.completed_at && new Date(task.completed_at) <= dayEnd
      );
      
      const completionRate = tasksCreatedByDate.length > 0 
        ? Math.round((tasksCompletedByDate.length / tasksCreatedByDate.length) * 100)
        : 0;
      
      this.timelineData.push({
        date: this.formatDate(currentDate),
        completionRate,
        completedTasks: tasksCompletedByDate.length,
        totalTasks: tasksCreatedByDate.length,
        period: 'daily'
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  private generateWeeklyData(startDate: Date, endDate: Date): void {
    const currentDate = new Date(startDate);
    
    // Start from beginning of week
    currentDate.setDate(currentDate.getDate() - currentDate.getDay());
    
    while (currentDate <= endDate) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const tasksCreatedByWeek = this.tasks.filter(task => 
        new Date(task.created_at) <= weekEnd
      );
      
      const tasksCompletedByWeek = tasksCreatedByWeek.filter(task => 
        task.completed_at && new Date(task.completed_at) <= weekEnd
      );
      
      const completionRate = tasksCreatedByWeek.length > 0 
        ? Math.round((tasksCompletedByWeek.length / tasksCreatedByWeek.length) * 100)
        : 0;
      
      this.timelineData.push({
        date: `Week of ${this.formatDate(weekStart)}`,
        completionRate,
        completedTasks: tasksCompletedByWeek.length,
        totalTasks: tasksCreatedByWeek.length,
        period: 'weekly'
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  private generateMonthlyData(startDate: Date, endDate: Date): void {
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (currentDate <= endDate) {
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const tasksCreatedByMonth = this.tasks.filter(task => 
        new Date(task.created_at) <= monthEnd
      );
      
      const tasksCompletedByMonth = tasksCreatedByMonth.filter(task => 
        task.completed_at && new Date(task.completed_at) <= monthEnd
      );
      
      const completionRate = tasksCreatedByMonth.length > 0 
        ? Math.round((tasksCompletedByMonth.length / tasksCreatedByMonth.length) * 100)
        : 0;
      
      this.timelineData.push({
        date: this.formatMonth(currentDate),
        completionRate,
        completedTasks: tasksCompletedByMonth.length,
        totalTasks: tasksCreatedByMonth.length,
        period: 'monthly'
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  private initializeChart(): void {
    if (!this.chartContainer) return;
    
    const containerWidth = this.chartContainer.nativeElement.offsetWidth;
    this.chartConfig.width = containerWidth - 20; // Account for padding
    
    if (this.chartCanvas) {
      const canvas = this.chartCanvas.nativeElement;
      canvas.width = this.chartConfig.width;
      canvas.height = this.chartConfig.height;
    }
  }

  private drawChart(): void {
    if (!this.chartCanvas || this.timelineData.length === 0) return;
    
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const { width, height, margin } = this.chartConfig;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Set up scales
    const xScale = chartWidth / (this.timelineData.length - 1);
    const yScale = chartHeight / 100; // 0-100% completion rate
    
    // Draw grid
    if (this.chartConfig.showGrid) {
      this.drawGrid(ctx, chartWidth, chartHeight, margin);
    }
    
    // Draw axes
    this.drawAxes(ctx, chartWidth, chartHeight, margin);
    
    // Draw line chart
    this.drawLineChart(ctx, xScale, yScale, margin);
    
    // Draw points
    this.drawDataPoints(ctx, xScale, yScale, margin);
    
    // Draw trend line
    this.drawTrendLine(ctx, xScale, yScale, margin);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any): void {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (height * i / 4);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + width, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    const xStep = width / (this.timelineData.length - 1);
    for (let i = 0; i < this.timelineData.length; i += Math.ceil(this.timelineData.length / 6)) {
      const x = margin.left + (i * xStep);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + height);
      ctx.stroke();
    }
  }

  private drawAxes(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any): void {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + height);
    ctx.stroke();
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + height);
    ctx.lineTo(margin.left + width, margin.top + height);
    ctx.stroke();
    
    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (height * (4 - i) / 4);
      const label = `${i * 25}%`;
      ctx.fillText(label, margin.left - 10, y + 4);
    }
    
    // X-axis labels
    ctx.textAlign = 'center';
    const xStep = width / (this.timelineData.length - 1);
    
    for (let i = 0; i < this.timelineData.length; i += Math.ceil(this.timelineData.length / 6)) {
      const x = margin.left + (i * xStep);
      const label = this.getShortDateLabel(this.timelineData[i].date);
      ctx.fillText(label, x, margin.top + height + 20);
    }
  }

  private drawLineChart(ctx: CanvasRenderingContext2D, xScale: number, yScale: number, margin: any): void {
    if (this.timelineData.length < 2) return;
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + (100 * yScale));
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    
    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + (100 - this.timelineData[0].completionRate) * yScale);
    
    this.timelineData.forEach((point, index) => {
      const x = margin.left + (index * xScale);
      const y = margin.top + (100 - point.completionRate) * yScale;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(margin.left + ((this.timelineData.length - 1) * xScale), margin.top + 100 * yScale);
    ctx.lineTo(margin.left, margin.top + 100 * yScale);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + (100 - this.timelineData[0].completionRate) * yScale);
    
    this.timelineData.forEach((point, index) => {
      const x = margin.left + (index * xScale);
      const y = margin.top + (100 - point.completionRate) * yScale;
      ctx.lineTo(x, y);
    });
    
    ctx.stroke();
  }

  private drawDataPoints(ctx: CanvasRenderingContext2D, xScale: number, yScale: number, margin: any): void {
    this.timelineData.forEach((point, index) => {
      const x = margin.left + (index * xScale);
      const y = margin.top + (100 - point.completionRate) * yScale;
      
      // Draw point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  private drawTrendLine(ctx: CanvasRenderingContext2D, xScale: number, yScale: number, margin: any): void {
    if (this.timelineData.length < 3) return;
    
    // Calculate linear regression
    const n = this.timelineData.length;
    const sumX = this.timelineData.reduce((sum, _, i) => sum + i, 0);
    const sumY = this.timelineData.reduce((sum, point) => sum + point.completionRate, 0);
    const sumXY = this.timelineData.reduce((sum, point, i) => sum + i * point.completionRate, 0);
    const sumXX = this.timelineData.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Draw trend line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const startY = margin.top + (100 - intercept) * yScale;
    const endY = margin.top + (100 - (slope * (n - 1) + intercept)) * yScale;
    
    ctx.beginPath();
    ctx.moveTo(margin.left, startY);
    ctx.lineTo(margin.left + (n - 1) * xScale, endY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString();
  }

  private formatMonth(date: Date): string {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  private getShortDateLabel(dateStr: string): string {
    if (dateStr.startsWith('Week of')) {
      return dateStr.split(' ')[2].split('/')[1] + '/' + dateStr.split(' ')[2].split('/')[2];
    }
    if (dateStr.includes(' ')) {
      return dateStr.split(' ')[0].substring(0, 3);
    }
    return dateStr.split('/')[1] + '/' + dateStr.split('/')[2];
  }

  // Event handlers
  onTimeRangeChange(range: string): void {
    this.selectedTimeRange = range;
    this.chartConfig.timeRange = range as any;
    this.generateTimelineData();
    this.drawChart();
  }

  onPeriodChange(period: 'daily' | 'weekly' | 'monthly'): void {
    this.selectedPeriod = period;
    this.generateTimelineData();
    this.drawChart();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.chartConfig.showTooltip) return;
    
    const canvas = this.chartCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Find nearest data point
    const { margin } = this.chartConfig;
    const xScale = (canvas.width - margin.left - margin.right) / (this.timelineData.length - 1);
    
    const dataIndex = Math.round((x - margin.left) / xScale);
    
    if (dataIndex >= 0 && dataIndex < this.timelineData.length) {
      this.hoveredPoint = this.timelineData[dataIndex];
      this.tooltipPosition = { x: event.clientX, y: event.clientY };
    } else {
      this.hoveredPoint = null;
    }
  }

  onCanvasMouseLeave(): void {
    this.hoveredPoint = null;
  }

  private handleResize(): void {
    setTimeout(() => {
      this.initializeChart();
      this.drawChart();
    }, 100);
  }

  getCurrentTrend(): 'improving' | 'declining' | 'stable' {
    if (this.timelineData.length < 3) return 'stable';
    
    const recent = this.timelineData.slice(-3);
    const avg = recent.reduce((sum, p) => sum + p.completionRate, 0) / recent.length;
    const earlier = this.timelineData.slice(0, 3);
    const earlierAvg = earlier.reduce((sum, p) => sum + p.completionRate, 0) / earlier.length;
    
    const diff = avg - earlierAvg;
    if (Math.abs(diff) < 5) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }

  getAverageCompletionRate(): number {
    if (this.timelineData.length === 0) return 0;
    return Math.round(this.timelineData.reduce((sum, p) => sum + p.completionRate, 0) / this.timelineData.length);
  }

  getBestPerformancePeriod(): string {
    if (this.timelineData.length < 3) return 'Not enough data';
    
    const maxRate = Math.max(...this.timelineData.map(d => d.completionRate));
    const bestPeriod = this.timelineData.find(d => d.completionRate === maxRate);
    
    if (bestPeriod) {
      return `🏆 Best performance: ${maxRate}% on ${bestPeriod.date}`;
    }
    
    return 'Performance data available';
  }
}