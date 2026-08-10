import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitsService } from '../../services/habits';

interface SimState {
  mood: 'depressed' | 'sad' | 'neutral' | 'happy' | 'ecstatic';
  energy: number; // 0-100
  health: number; // 0-100
  motivation: number; // 0-100
  activity: 'sleeping' | 'resting' | 'working' | 'exercising' | 'celebrating';
  appearance: {
    face: string;
    body: string;
    clothing: string;
    accessories: string[];
  };
}

@Component({
  selector: 'app-habit-sim',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './habit-sim.html',
  styleUrl: './habit-sim.scss'
})
export class HabitSimComponent {
  private habitsService = inject(HabitsService);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;

  // Computed sim state based on user's habit progress
  protected simState = computed<SimState>(() => {
    const overallProgress = this.habitsService.getOverallProgress();
    const streak = this.gameState().dailyStreak;
    const level = this.gameState().level;
    const totalPoints = this.gameState().totalPoints;
    
    // Calculate health based on good habits completion
    const goodHabits = this.habits().filter(h => h.type === 'good');
    const completedGoodHabits = goodHabits.filter(h => 
      this.habitsService.isHabitCompletedOnDate(h.id, new Date())
    ).length;
    const health = goodHabits.length > 0 ? Math.round((completedGoodHabits / goodHabits.length) * 100) : 50;
    
    // Calculate energy based on recent activity
    const energy = Math.min(100, Math.max(0, 50 + (streak * 5) + (overallProgress / 2)));
    
    // Calculate motivation based on level and points
    const motivation = Math.min(100, Math.max(0, 30 + (level * 10) + (totalPoints / 10)));
    
    // Determine mood based on overall metrics
    let mood: SimState['mood'] = 'neutral';
    const averageMetric = (health + energy + motivation) / 3;
    
    if (averageMetric >= 80) mood = 'ecstatic';
    else if (averageMetric >= 60) mood = 'happy';
    else if (averageMetric >= 40) mood = 'neutral';
    else if (averageMetric >= 20) mood = 'sad';
    else mood = 'depressed';
    
    // Determine activity based on time and progress
    let activity: SimState['activity'] = 'resting';
    const hour = new Date().getHours();
    
    if (overallProgress === 100) activity = 'celebrating';
    else if (hour < 6 || hour > 22) activity = 'sleeping';
    else if (overallProgress > 50) activity = 'working';
    else if (health > 70) activity = 'exercising';
    else activity = 'resting';
    
    // Determine appearance based on progress and level
    const appearance = this.getAppearance(level, mood, health);
    
    return {
      mood,
      energy,
      health,
      motivation,
      activity,
      appearance
    };
  });

  private getAppearance(level: number, mood: SimState['mood'], health: number): SimState['appearance'] {
    // Face changes based on mood
    const faces = {
      depressed: '😞',
      sad: '😔',
      neutral: '😐',
      happy: '😊',
      ecstatic: '😄'
    };
    
    // Body changes based on health level
    let body = '🧍‍♂️'; // default standing person
    if (health >= 80) body = '💪'; // strong
    else if (health >= 60) body = '🧍‍♂️'; // normal
    else if (health >= 40) body = '🤷‍♂️'; // meh
    else body = '🤕'; // sick
    
    // Clothing improves with level
    let clothing = '👕'; // basic shirt
    if (level >= 10) clothing = '🎽'; // athletic wear
    else if (level >= 5) clothing = '👔'; // business casual
    
    // Accessories unlock with achievements
    const accessories: string[] = [];
    if (level >= 3) accessories.push('🎒'); // backpack
    if (level >= 7) accessories.push('⌚'); // watch
    if (level >= 15) accessories.push('👑'); // crown
    
    return {
      face: faces[mood],
      body,
      clothing,
      accessories
    };
  }

  // Helper methods for template
  getStatusMessage(): string {
    const state = this.simState();
    const messages = {
      depressed: "I'm feeling really down... maybe some habits would help?",
      sad: "Not having the best day, but I'm trying!",
      neutral: "Just going through the motions today.",
      happy: "Feeling good about our progress!",
      ecstatic: "This is amazing! We're crushing our goals!"
    };
    return messages[state.mood];
  }

  getActivityMessage(): string {
    const state = this.simState();
    const messages = {
      sleeping: "Zzz... Getting some rest",
      resting: "Taking a well-deserved break",
      working: "Productive and focused!",
      exercising: "Getting stronger every day!",
      celebrating: "Perfect day! 🎉"
    };
    return messages[state.activity];
  }

  getProgressColor(value: number): string {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-blue-600';
    if (value >= 40) return 'text-yellow-600';
    if (value >= 20) return 'text-orange-600';
    return 'text-red-600';
  }

  getMoodColor(): string {
    const mood = this.simState().mood;
    const colors = {
      depressed: 'text-red-700',
      sad: 'text-orange-600',
      neutral: 'text-slate-600',
      happy: 'text-blue-600',
      ecstatic: 'text-green-600'
    };
    return colors[mood];
  }
}