import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService } from '../tournament';
import { Girl, Interaction, DatePlan, PickupLine, MaleProfile } from '../models';

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  description?: string;
}

interface ChartData {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-stats',
  imports: [CommonModule],
  templateUrl: './stats.html',
  styleUrl: './stats.scss'
})
export class StatsComponent implements OnInit {
  girls: Girl[] = [];
  datePlans: DatePlan[] = [];
  pickupLines: PickupLine[] = [];
  maleProfile: MaleProfile | null = null;
  
  overviewStats: StatCard[] = [];
  interactionStats: StatCard[] = [];
  dateStats: StatCard[] = [];
  pickupLineStats: StatCard[] = [];
  maleProfileStats: StatCard[] = [];

  topGirls: Girl[] = [];
  recentActivity: any[] = [];
  interactionTrends: ChartData[] = [];

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
    this.calculateStats();
  }

  loadData() {
    this.girls = this.tournamentService.getGirls();
    this.datePlans = this.tournamentService.getDatePlans();
    this.pickupLines = this.tournamentService.getPickupLines();
    this.maleProfile = this.tournamentService.getMaleProfile();
  }

  calculateStats() {
    this.calculateOverviewStats();
    this.calculateInteractionStats();
    this.calculateDateStats();
    this.calculatePickupLineStats();
    this.calculateMaleProfileStats();
    this.calculateTopGirls();
    this.calculateRecentActivity();
    this.calculateInteractionTrends();
  }

  calculateOverviewStats() {
    const totalInteractions = this.girls.reduce((total, girl) => total + (girl.interactions?.length || 0), 0);
    const totalPoints = this.girls.reduce((total, girl) => total + (girl.totalPoints || 0), 0);
    const avgPointsPerGirl = this.girls.length > 0 ? Math.round(totalPoints / this.girls.length) : 0;
    
    this.overviewStats = [
      {
        title: 'Total Girls',
        value: this.girls.length,
        icon: '👥',
        color: 'text-primary',
        description: 'People in your network'
      },
      {
        title: 'Total Interactions',
        value: totalInteractions,
        icon: '💬',
        color: 'text-info',
        description: 'Conversations and meetings'
      },
      {
        title: 'Total Points',
        value: totalPoints,
        icon: '⭐',
        color: 'text-success',
        description: 'Your social progress'
      },
      {
        title: 'Avg Points/Girl',
        value: avgPointsPerGirl,
        icon: '📊',
        color: 'text-warning',
        description: 'Average relationship score'
      }
    ];
  }

  calculateInteractionStats() {
    const allInteractions = this.girls.flatMap(girl => girl.interactions || []);
    const positiveInteractions = allInteractions.filter(i => i.points > 0).length;
    const negativeInteractions = allInteractions.filter(i => i.points < 0).length;
    const neutralInteractions = allInteractions.filter(i => i.points === 0).length;
    const avgPointsPerInteraction = allInteractions.length > 0 ? 
      Math.round(allInteractions.reduce((sum, i) => sum + i.points, 0) / allInteractions.length) : 0;

    this.interactionStats = [
      {
        title: 'Positive Interactions',
        value: positiveInteractions,
        icon: '😊',
        color: 'text-success',
        description: 'Interactions with positive points'
      },
      {
        title: 'Negative Interactions',
        value: negativeInteractions,
        icon: '😞',
        color: 'text-error',
        description: 'Interactions with negative points'
      },
      {
        title: 'Neutral Interactions',
        value: neutralInteractions,
        icon: '😐',
        color: 'text-neutral',
        description: 'Interactions with zero points'
      },
      {
        title: 'Avg Points/Interaction',
        value: avgPointsPerInteraction,
        icon: '📈',
        color: 'text-info',
        description: 'Average points per interaction'
      }
    ];
  }

  calculateDateStats() {
    const completedDates = this.datePlans.filter(d => d.status === 'completed').length;
    const plannedDates = this.datePlans.filter(d => d.status === 'planned').length;
    const upcomingDates = this.datePlans.filter(d => d.status === 'planned' && new Date(d.date) > new Date()).length;
    const avgDateRating = this.datePlans.filter(d => d.rating).length > 0 ?
      Math.round(this.datePlans.filter(d => d.rating).reduce((sum, d) => sum + (d.rating || 0), 0) / this.datePlans.filter(d => d.rating).length * 10) / 10 : 0;

    this.dateStats = [
      {
        title: 'Total Date Plans',
        value: this.datePlans.length,
        icon: '📅',
        color: 'text-primary',
        description: 'All planned dates'
      },
      {
        title: 'Completed Dates',
        value: completedDates,
        icon: '✅',
        color: 'text-success',
        description: 'Successfully completed dates'
      },
      {
        title: 'Upcoming Dates',
        value: upcomingDates,
        icon: '🔜',
        color: 'text-info',
        description: 'Future planned dates'
      },
      {
        title: 'Avg Date Rating',
        value: avgDateRating || 'N/A',
        icon: '⭐',
        color: 'text-warning',
        description: 'Average rating of completed dates'
      }
    ];
  }

  calculatePickupLineStats() {
    const ratedLines = this.pickupLines.filter(line => line.rating).length;
    const topRatedLines = this.pickupLines.filter(line => line.rating && line.rating >= 4).length;
    const totalUsage = this.pickupLines.reduce((sum, line) => sum + line.timesUsed, 0);
    const avgRating = ratedLines > 0 ?
      Math.round(this.pickupLines.filter(line => line.rating).reduce((sum, line) => sum + (line.rating || 0), 0) / ratedLines * 10) / 10 : 0;

    this.pickupLineStats = [
      {
        title: 'Total Pickup Lines',
        value: this.pickupLines.length,
        icon: '💬',
        color: 'text-primary',
        description: 'Lines in your arsenal'
      },
      {
        title: 'Top Rated Lines',
        value: topRatedLines,
        icon: '🏆',
        color: 'text-success',
        description: 'Lines rated 4+ stars'
      },
      {
        title: 'Total Usage',
        value: totalUsage,
        icon: '🔄',
        color: 'text-info',
        description: 'Times lines have been used'
      },
      {
        title: 'Avg Rating',
        value: avgRating || 'N/A',
        icon: '⭐',
        color: 'text-warning',
        description: 'Average line effectiveness'
      }
    ];
  }

  calculateMaleProfileStats() {
    if (!this.maleProfile) {
      this.maleProfileStats = [];
      return;
    }

    const activeTraits = this.maleProfile.traits.filter(trait => trait.active).length;
    const positiveTraits = this.maleProfile.traits.filter(trait => trait.active && trait.points > 0).length;
    const negativeTraits = this.maleProfile.traits.filter(trait => trait.active && trait.points < 0).length;
    const nonNegotiablesMet = this.maleProfile.nonNegotiables.filter(nn => nn.met).length;

    this.maleProfileStats = [
      {
        title: 'Total Score',
        value: this.maleProfile.totalScore,
        icon: '💯',
        color: this.maleProfile.totalScore >= 0 ? 'text-success' : 'text-error',
        description: 'Your overall attractiveness score'
      },
      {
        title: 'Positive Traits',
        value: positiveTraits,
        icon: '✨',
        color: 'text-success',
        description: 'Active positive traits'
      },
      {
        title: 'Areas to Improve',
        value: negativeTraits,
        icon: '🔧',
        color: 'text-error',
        description: 'Active negative traits'
      },
      {
        title: 'Non-Negotiables Met',
        value: `${nonNegotiablesMet}/${this.maleProfile.nonNegotiables.length}`,
        icon: '🎯',
        color: 'text-info',
        description: 'Essential requirements achieved'
      }
    ];
  }

  calculateTopGirls() {
    this.topGirls = [...this.girls]
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
      .slice(0, 5);
  }

  calculateRecentActivity() {
    const allInteractions = this.girls.flatMap(girl => 
      (girl.interactions || []).map(interaction => ({
        ...interaction,
        girlName: girl.name,
        girlAvatar: girl.avatar,
        type: 'interaction'
      }))
    );

    const recentDates = this.datePlans.map(date => ({
      ...date,
      girlName: this.tournamentService.getGirlById(date.girlId)?.name || 'Unknown',
      type: 'date'
    }));

    this.recentActivity = [...allInteractions, ...recentDates]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  calculateInteractionTrends() {
    const interactionTypes: { [key: string]: number } = {};
    
    this.girls.forEach(girl => {
      (girl.interactions || []).forEach(interaction => {
        interactionTypes[interaction.type] = (interactionTypes[interaction.type] || 0) + 1;
      });
    });

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];
    let colorIndex = 0;

    this.interactionTrends = Object.entries(interactionTypes)
      .map(([type, count]) => ({
        label: type,
        value: count,
        color: colors[colorIndex++ % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  getActivityIcon(activity: any): string {
    if (activity.type === 'interaction') {
      return '💬';
    } else if (activity.type === 'date') {
      return '📅';
    }
    return '📝';
  }

  getActivityColor(activity: any): string {
    if (activity.type === 'interaction') {
      return activity.points > 0 ? 'text-success' : activity.points < 0 ? 'text-error' : 'text-neutral';
    } else if (activity.type === 'date') {
      return activity.status === 'completed' ? 'text-success' : 'text-info';
    }
    return 'text-neutral';
  }
}
