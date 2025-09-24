import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../tournament';

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: 'social' | 'confidence' | 'skill' | 'lifestyle' | 'fitness';
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  timeLimit?: number;
  status: 'available' | 'active' | 'completed' | 'failed';
  startDate?: Date;
  completionDate?: Date;
  progress?: number;
  requirements?: string[];
  reward?: string;
  notes?: string;
}

@Component({
  selector: 'app-challenges',
  imports: [CommonModule, FormsModule],
  templateUrl: './challenges.html',
  styleUrl: './challenges.scss'
})
export class ChallengesComponent implements OnInit {
  challenges: Challenge[] = [];
  activeChallenges: Challenge[] = [];
  completedChallenges: Challenge[] = [];
  showCreateChallenge = false;
  selectedChallenge: Challenge | null = null;

  defaultChallenges: Omit<Challenge, 'id' | 'status'>[] = [
    {
      title: 'Start 5 Conversations',
      description: 'Initiate conversations with 5 different people in one day',
      category: 'social',
      difficulty: 'easy',
      points: 50,
      timeLimit: 24,
      requirements: ['Be genuine', 'Ask open-ended questions', 'Listen actively'],
      reward: 'Social Confidence Badge'
    },
    {
      title: 'Compliment Streak',
      description: 'Give genuine compliments to 3 different people',
      category: 'social',
      difficulty: 'easy',
      points: 30,
      requirements: ['Be specific', 'Make eye contact', 'Be sincere'],
      reward: 'Kindness Badge'
    },
    {
      title: 'Public Speaking',
      description: 'Speak up in a group setting or give a short presentation',
      category: 'confidence',
      difficulty: 'medium',
      points: 100,
      requirements: ['Prepare talking points', 'Practice beforehand', 'Maintain confidence'],
      reward: 'Confidence Booster Badge'
    },
    {
      title: 'Learn New Skill',
      description: 'Spend 3 hours learning something new that could impress others',
      category: 'skill',
      difficulty: 'medium',
      points: 75,
      timeLimit: 168,
      requirements: ['Choose something interesting', 'Practice regularly', 'Share your progress'],
      reward: 'Scholar Badge'
    },
    {
      title: 'Social Event Attendance',
      description: 'Attend a social event where you know less than 3 people',
      category: 'social',
      difficulty: 'hard',
      points: 150,
      requirements: ['Introduce yourself to new people', 'Stay for at least 1 hour', 'Exchange contacts'],
      reward: 'Social Butterfly Badge'
    },
    {
      title: 'Style Upgrade',
      description: 'Update your wardrobe or grooming routine',
      category: 'lifestyle',
      difficulty: 'medium',
      points: 80,
      requirements: ['Get feedback from others', 'Try something new', 'Feel confident in changes'],
      reward: 'Style Icon Badge'
    },
    {
      title: 'Fitness Challenge',
      description: 'Complete a 7-day fitness routine',
      category: 'fitness',
      difficulty: 'medium',
      points: 100,
      timeLimit: 168,
      requirements: ['Exercise daily', 'Track progress', 'Maintain consistency'],
      reward: 'Fitness Enthusiast Badge'
    },
    {
      title: 'Date Request',
      description: 'Ask someone on a date (regardless of outcome)',
      category: 'confidence',
      difficulty: 'hard',
      points: 200,
      requirements: ['Be direct and honest', 'Accept the response gracefully', 'Learn from the experience'],
      reward: 'Courage Badge'
    }
  ];

  newChallenge = {
    title: '',
    description: '',
    category: 'social' as Challenge['category'],
    difficulty: 'easy' as Challenge['difficulty'],
    points: 50,
    timeLimit: 0,
    requirements: [] as string[]
  };

  constructor(private tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadChallenges();
  }

  loadChallenges() {
    const stored = localStorage.getItem('socialGameChallenges');
    if (stored) {
      this.challenges = JSON.parse(stored);
    } else {
      this.initializeDefaultChallenges();
    }
    this.updateChallengeArrays();
  }

  initializeDefaultChallenges() {
    this.challenges = this.defaultChallenges.map(challenge => ({
      ...challenge,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      status: 'available' as Challenge['status']
    }));
    this.saveChallenges();
  }

  saveChallenges() {
    localStorage.setItem('socialGameChallenges', JSON.stringify(this.challenges));
  }

  updateChallengeArrays() {
    this.activeChallenges = this.challenges.filter(c => c.status === 'active');
    this.completedChallenges = this.challenges.filter(c => c.status === 'completed');
  }

  startChallenge(challenge: Challenge) {
    challenge.status = 'active';
    challenge.startDate = new Date();
    challenge.progress = 0;
    this.saveChallenges();
    this.updateChallengeArrays();
  }

  completeChallenge(challenge: Challenge) {
    const notes = prompt('Any notes about completing this challenge?');
    challenge.status = 'completed';
    challenge.completionDate = new Date();
    challenge.progress = 100;
    challenge.notes = notes || undefined;
    this.saveChallenges();
    this.updateChallengeArrays();
  }

  failChallenge(challenge: Challenge) {
    const notes = prompt('What went wrong? (Optional notes)');
    challenge.status = 'failed';
    challenge.notes = notes || undefined;
    this.saveChallenges();
    this.updateChallengeArrays();
  }

  resetChallenge(challenge: Challenge) {
    challenge.status = 'available';
    challenge.startDate = undefined;
    challenge.completionDate = undefined;
    challenge.progress = undefined;
    challenge.notes = undefined;
    this.saveChallenges();
    this.updateChallengeArrays();
  }

  createCustomChallenge() {
    if (!this.newChallenge.title.trim()) return;

    const challenge: Challenge = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: this.newChallenge.title,
      description: this.newChallenge.description,
      category: this.newChallenge.category,
      difficulty: this.newChallenge.difficulty,
      points: this.newChallenge.points,
      timeLimit: this.newChallenge.timeLimit || undefined,
      status: 'available',
      requirements: this.newChallenge.requirements.length ? this.newChallenge.requirements : undefined
    };

    this.challenges.push(challenge);
    this.saveChallenges();
    this.resetCreateForm();
    this.updateChallengeArrays();
  }

  resetCreateForm() {
    this.showCreateChallenge = false;
    this.newChallenge = {
      title: '',
      description: '',
      category: 'social',
      difficulty: 'easy',
      points: 50,
      timeLimit: 0,
      requirements: []
    };
  }

  addRequirement(req: string) {
    if (req.trim() && !this.newChallenge.requirements.includes(req.trim())) {
      this.newChallenge.requirements.push(req.trim());
    }
  }

  removeRequirement(index: number) {
    this.newChallenge.requirements.splice(index, 1);
  }

  getCategoryIcon(category: string): string {
    const icons = {
      social: '👥',
      confidence: '💪',
      skill: '🎯',
      lifestyle: '✨',
      fitness: '🏃‍♂️'
    };
    return icons[category as keyof typeof icons] || '📋';
  }

  getDifficultyColor(difficulty: string): string {
    const colors = {
      easy: 'badge-success',
      medium: 'badge-warning',
      hard: 'badge-error'
    };
    return colors[difficulty as keyof typeof colors] || 'badge-neutral';
  }

  getStatusColor(status: string): string {
    const colors = {
      available: 'badge-neutral',
      active: 'badge-info',
      completed: 'badge-success',
      failed: 'badge-error'
    };
    return colors[status as keyof typeof colors] || 'badge-neutral';
  }

  getTimeRemaining(challenge: Challenge): string {
    if (!challenge.timeLimit || !challenge.startDate) return '';
    
    const endTime = new Date(challenge.startDate.getTime() + (challenge.timeLimit * 60 * 60 * 1000));
    const now = new Date();
    const remaining = endTime.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  }

  getTotalPoints(): number {
    return this.completedChallenges.reduce((total, challenge) => total + challenge.points, 0);
  }

  getCompletionRate(): number {
    const attempted = this.challenges.filter(c => c.status !== 'available').length;
    if (attempted === 0) return 0;
    return Math.round((this.completedChallenges.length / attempted) * 100);
  }

  getAvailableChallenges(): Challenge[] {
    return this.challenges.filter(c => c.status === 'available');
  }

  getFailedChallenges(): Challenge[] {
    return this.challenges.filter(c => c.status === 'failed');
  }
}
