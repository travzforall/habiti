import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MarkdownTask } from './markdown-sync.service';

export interface TaskQueue {
  id: string;
  name: string;
  agent: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentTask?: MarkdownTask;
  remainingTasks: MarkdownTask[];
  completedTasks: MarkdownTask[];
  startTime?: Date;
  estimatedCompletion?: Date;
  progress: number;
}

export interface AgentSlot {
  id: string;
  agent: string;
  status: 'available' | 'busy' | 'offline';
  currentQueue?: string;
  tasksCompleted: number;
  efficiency: number; // tasks per hour
}

@Injectable({
  providedIn: 'root'
})
export class QueueManagerService {
  private maxConcurrentAgents = 3;
  private queuesSubject = new BehaviorSubject<TaskQueue[]>([]);
  private agentSlotsSubject = new BehaviorSubject<AgentSlot[]>([]);
  private isRunningSubject = new BehaviorSubject<boolean>(false);

  public queues$ = this.queuesSubject.asObservable();
  public agentSlots$ = this.agentSlotsSubject.asObservable();
  public isRunning$ = this.isRunningSubject.asObservable();

  private executionInterval: any;

  constructor() {
    this.initializeAgentSlots();
  }

  // Initialize available agent slots
  private initializeAgentSlots(): void {
    const agents = [
      'UI-Designer',
      'Frontend-Developer', 
      'Backend-Architect',
      'DevOps-Automator',
      'AI-Engineer',
      'Performance-Benchmarker',
      'Mobile-App-Builder',
      'Whimsy-Injector',
      'Rapid-Prototyper'
    ];

    const slots: AgentSlot[] = agents.map(agent => ({
      id: `slot-${agent.toLowerCase()}`,
      agent,
      status: 'available',
      tasksCompleted: 0,
      efficiency: this.calculateAgentEfficiency(agent)
    }));

    this.agentSlotsSubject.next(slots);
  }

  // Calculate estimated efficiency for each agent type
  private calculateAgentEfficiency(agent: string): number {
    const efficiencyMap: { [key: string]: number } = {
      'UI-Designer': 2.5, // tasks per hour
      'Frontend-Developer': 3.0,
      'Backend-Architect': 2.0,
      'DevOps-Automator': 1.5,
      'AI-Engineer': 2.0,
      'Performance-Benchmarker': 3.5,
      'Mobile-App-Builder': 2.5,
      'Whimsy-Injector': 4.0,
      'Rapid-Prototyper': 5.0
    };
    return efficiencyMap[agent] || 2.0;
  }

  // Set maximum concurrent agents
  setMaxConcurrentAgents(max: number): void {
    this.maxConcurrentAgents = Math.max(1, Math.min(max, 9));
    console.log(`🎛️ Max concurrent agents set to: ${this.maxConcurrentAgents}`);
  }

  // Create task queues from tasks, grouped by agent and prioritized
  createQueuesFromTasks(tasks: MarkdownTask[]): TaskQueue[] {
    // Group tasks by agent
    const tasksByAgent = new Map<string, MarkdownTask[]>();
    
    tasks.filter(task => !task.completed).forEach(task => {
      if (!tasksByAgent.has(task.agent)) {
        tasksByAgent.set(task.agent, []);
      }
      tasksByAgent.get(task.agent)!.push(task);
    });

    // Sort tasks within each agent by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    const queues: TaskQueue[] = [];
    let queueIndex = 0;

    tasksByAgent.forEach((agentTasks, agent) => {
      // Sort by priority, then by estimated hours (shorter tasks first within same priority)
      const sortedTasks = agentTasks.sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        
        const aHours = a.estimatedHours || 1;
        const bHours = b.estimatedHours || 1;
        return aHours - bHours;
      });

      const queue: TaskQueue = {
        id: `queue-${queueIndex++}`,
        name: `${agent} Queue`,
        agent,
        status: 'idle',
        remainingTasks: [...sortedTasks],
        completedTasks: [],
        progress: 0
      };

      queues.push(queue);
    });

    // Sort queues by total priority score and task count
    queues.sort((a, b) => {
      const aScore = this.calculateQueuePriority(a);
      const bScore = this.calculateQueuePriority(b);
      return bScore - aScore;
    });

    this.queuesSubject.next(queues);
    console.log(`📋 Created ${queues.length} task queues from ${tasks.length} tasks`);
    
    return queues;
  }

  // Calculate priority score for queue ordering
  private calculateQueuePriority(queue: TaskQueue): number {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    
    let totalScore = 0;
    queue.remainingTasks.forEach(task => {
      totalScore += priorityScores[task.priority] || 2;
    });

    // Factor in agent efficiency and task count
    const agentEfficiency = this.calculateAgentEfficiency(queue.agent);
    return totalScore * agentEfficiency * queue.remainingTasks.length;
  }

  // Start queue execution system
  startExecution(): void {
    if (this.isRunningSubject.value) return;

    this.isRunningSubject.next(true);
    
    // Check and process queues every 30 seconds
    this.executionInterval = setInterval(() => {
      this.processQueues();
    }, 30000);

    // Initial processing
    this.processQueues();
    console.log('🚀 Queue execution started');
  }

  // Stop queue execution
  stopExecution(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    // Set all running queues to paused
    const queues = this.queuesSubject.value;
    const updatedQueues = queues.map(queue => ({
      ...queue,
      status: queue.status === 'running' ? 'paused' as const : queue.status
    }));
    
    this.queuesSubject.next(updatedQueues);

    // Free up agent slots
    const slots = this.agentSlotsSubject.value;
    const updatedSlots = slots.map(slot => ({
      ...slot,
      status: 'available' as const,
      currentQueue: undefined
    }));
    
    this.agentSlotsSubject.next(updatedSlots);

    this.isRunningSubject.next(false);
    console.log('⏸️ Queue execution stopped');
  }

  // Process queues and assign to available agent slots
  private processQueues(): void {
    const queues = this.queuesSubject.value;
    const slots = this.agentSlotsSubject.value;

    // Find available slots
    const availableSlots = slots.filter(slot => slot.status === 'available');
    const busySlots = slots.filter(slot => slot.status === 'busy');

    // Don't exceed max concurrent agents
    const canAssign = Math.min(
      availableSlots.length, 
      this.maxConcurrentAgents - busySlots.length
    );

    if (canAssign <= 0) return;

    // Find queues ready to run (idle or paused with remaining tasks)
    const readyQueues = queues
      .filter(queue => 
        (queue.status === 'idle' || queue.status === 'paused') && 
        queue.remainingTasks.length > 0
      )
      .slice(0, canAssign);

    // Assign queues to slots
    for (let i = 0; i < readyQueues.length && i < availableSlots.length; i++) {
      const queue = readyQueues[i];
      const slot = availableSlots[i];

      // Prefer matching agent types
      const matchingSlot = availableSlots.find(s => s.agent === queue.agent);
      const assignedSlot = matchingSlot || slot;

      this.assignQueueToSlot(queue, assignedSlot);
    }
  }

  // Assign a queue to an agent slot
  private assignQueueToSlot(queue: TaskQueue, slot: AgentSlot): void {
    // Update queue status
    const queues = this.queuesSubject.value;
    const updatedQueues = queues.map(q => {
      if (q.id === queue.id) {
        const currentTask = q.remainingTasks[0];
        const estimatedHours = currentTask?.estimatedHours || 1;
        const estimatedCompletion = new Date();
        estimatedCompletion.setHours(estimatedCompletion.getHours() + estimatedHours);

        return {
          ...q,
          status: 'running' as const,
          currentTask,
          startTime: new Date(),
          estimatedCompletion
        };
      }
      return q;
    });

    // Update slot status
    const slots = this.agentSlotsSubject.value;
    const updatedSlots = slots.map(s => 
      s.id === slot.id 
        ? { ...s, status: 'busy' as const, currentQueue: queue.id }
        : s
    );

    this.queuesSubject.next(updatedQueues);
    this.agentSlotsSubject.next(updatedSlots);

    console.log(`🎯 Assigned ${queue.name} to ${slot.agent} slot`);
  }

  // Simulate task completion (for testing)
  simulateTaskCompletion(queueId: string): void {
    const queues = this.queuesSubject.value;
    const updatedQueues = queues.map(queue => {
      if (queue.id === queueId && queue.currentTask) {
        const completed = queue.currentTask;
        const remaining = queue.remainingTasks.slice(1);
        const completedTasks = [...queue.completedTasks, { ...completed, completed: true }];
        
        const progress = remaining.length === 0 ? 100 : 
          ((queue.remainingTasks.length - remaining.length) / queue.remainingTasks.length) * 100;

        // Update agent slot efficiency
        this.updateAgentEfficiency(queue.agent);

        return {
          ...queue,
          currentTask: remaining[0] || undefined,
          remainingTasks: remaining,
          completedTasks,
          progress,
          status: remaining.length === 0 ? 'completed' as const : queue.status
        };
      }
      return queue;
    });

    this.queuesSubject.next(updatedQueues);

    // Free up slot if queue is completed
    const completedQueue = updatedQueues.find(q => q.id === queueId && q.status === 'completed');
    if (completedQueue) {
      this.freeAgentSlot(queueId);
    }
  }

  // Update agent efficiency based on completion
  private updateAgentEfficiency(agent: string): void {
    const slots = this.agentSlotsSubject.value;
    const updatedSlots = slots.map(slot => {
      if (slot.agent === agent) {
        return {
          ...slot,
          tasksCompleted: slot.tasksCompleted + 1,
          efficiency: slot.efficiency * 1.02 // Slight efficiency improvement
        };
      }
      return slot;
    });
    
    this.agentSlotsSubject.next(updatedSlots);
  }

  // Free up an agent slot when queue completes
  private freeAgentSlot(queueId: string): void {
    const slots = this.agentSlotsSubject.value;
    const updatedSlots = slots.map(slot => 
      slot.currentQueue === queueId 
        ? { ...slot, status: 'available' as const, currentQueue: undefined }
        : slot
    );
    
    this.agentSlotsSubject.next(updatedSlots);
  }

  // Get current execution statistics
  getExecutionStats(): any {
    const queues = this.queuesSubject.value;
    const slots = this.agentSlotsSubject.value;

    const totalTasks = queues.reduce((sum, q) => sum + q.remainingTasks.length + q.completedTasks.length, 0);
    const completedTasks = queues.reduce((sum, q) => sum + q.completedTasks.length, 0);
    const runningQueues = queues.filter(q => q.status === 'running').length;
    const availableSlots = slots.filter(s => s.status === 'available').length;

    return {
      totalTasks,
      completedTasks,
      remainingTasks: totalTasks - completedTasks,
      progressPercentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      runningQueues,
      availableSlots,
      maxConcurrentAgents: this.maxConcurrentAgents,
      isRunning: this.isRunningSubject.value
    };
  }

  // Pause specific queue
  pauseQueue(queueId: string): void {
    const queues = this.queuesSubject.value;
    const updatedQueues = queues.map(q => 
      q.id === queueId ? { ...q, status: 'paused' as const } : q
    );
    
    this.queuesSubject.next(updatedQueues);
    this.freeAgentSlot(queueId);
  }

  // Resume specific queue
  resumeQueue(queueId: string): void {
    const queues = this.queuesSubject.value;
    const updatedQueues = queues.map(q => 
      q.id === queueId && q.remainingTasks.length > 0 ? { ...q, status: 'idle' as const } : q
    );
    
    this.queuesSubject.next(updatedQueues);
  }
}