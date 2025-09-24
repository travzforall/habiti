import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from './tournament';
import { GameStats } from './models';
import { TournamentComponent } from './tournament/tournament';
import { MaleProfileComponent } from './male-profile/male-profile';
import { BracketComponent } from './bracket/bracket';
import { DatePlannerComponent } from './date-planner/date-planner';
import { PickupLinesComponent } from './pickup-lines/pickup-lines';
import { ProfilesComponent } from './profiles/profiles';
import { ChallengesComponent } from './challenges/challenges';
import { StatsComponent } from './stats/stats';

@Component({
  selector: 'app-game',
  imports: [
    CommonModule, 
    FormsModule, 
    TournamentComponent, 
    MaleProfileComponent, 
    BracketComponent, 
    DatePlannerComponent, 
    PickupLinesComponent, 
    ProfilesComponent, 
    ChallengesComponent, 
    StatsComponent
  ],
  templateUrl: './game.html',
  styleUrl: './game.scss'
})
export class GameComponent implements OnInit {
  viewMode: 'tournament' | 'male-profile' | 'bracket' | 'date-planner' | 'pickup-lines' | 'profiles' | 'challenges' | 'stats' = 'tournament';
  gameStats: GameStats | null = null;

  constructor(private tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadGameStats();
  }

  loadGameStats() {
    // Create basic game stats from existing data
    const girls = this.tournamentService.getGirls();
    const totalInteractions = girls.reduce((total, girl) => total + (girl.interactions?.length || 0), 0);
    const totalPoints = girls.reduce((total, girl) => total + (girl.totalPoints || 0), 0);
    
    this.gameStats = {
      socialSkillLevel: Math.max(1, Math.floor(totalPoints / 100) + 1),
      charismaPoints: Math.max(0, totalPoints),
      confidenceLevel: Math.min(100, Math.max(10, (totalPoints * 2) + 10)),
      totalInteractions: totalInteractions,
      averageRelationshipLevel: girls.length > 0 ? Math.round(girls.reduce((sum, g) => sum + (g.stats?.relationshipLevel || 0), 0) / girls.length) : 0,
      mostInteractedGirl: girls.length > 0 ? girls.reduce((prev, current) => ((prev.stats?.interactionCount || 0) > (current.stats?.interactionCount || 0)) ? prev : current).id : null,
      currentChampion: girls.length > 0 ? girls.reduce((prev, current) => ((prev.tournamentScore || 0) > (current.tournamentScore || 0)) ? prev : current).id : null,
      tournamentsCompleted: 0,
      challengesCompleted: 0,
      totalDatesCompleted: this.tournamentService.getDatePlans().filter(d => d.status === 'completed').length,
      currentStreak: 0,
      longestStreak: 0,
      totalPointsEarned: Math.max(0, totalPoints),
      averageInteractionScore: totalInteractions > 0 ? Math.round(totalPoints / totalInteractions) : 0
    };
  }
}