import { Injectable } from '@angular/core';
import { Girl, Interaction, TournamentRound, Challenge, SocialGoal, GameStats, MaleProfile, NonNegotiable, Trait, TournamentBracket, TournamentMatch, DatePlan, PickupLine, PickupLineReaction } from './models';

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private readonly STORAGE_KEYS = {
    GIRLS: 'tournament_girls',
    INTERACTIONS: 'tournament_interactions',
    ROUNDS: 'tournament_rounds',
    CHALLENGES: 'tournament_challenges',
    GOALS: 'tournament_goals',
    STATS: 'tournament_stats',
    MALE_PROFILE: 'tournament_male_profile',
    BRACKETS: 'tournament_brackets',
    DATE_PLANS: 'tournament_date_plans',
    PICKUP_LINES: 'tournament_pickup_lines'
  };

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    if (!this.getGirls().length) {
      this.saveGirls(this.getDefaultGirls());
    }
    if (!this.getGameStats()) {
      this.saveGameStats(this.getDefaultStats());
    }
    if (!this.getMaleProfile()) {
      this.saveMaleProfile(this.getDefaultMaleProfile());
    }
    if (!this.getPickupLines().length) {
      this.savePickupLines(this.getDefaultPickupLines());
    }
  }

  // Male Profile Management
  getMaleProfile(): MaleProfile | null {
    const stored = localStorage.getItem(this.STORAGE_KEYS.MALE_PROFILE);
    return stored ? JSON.parse(stored) : null;
  }

  saveMaleProfile(profile: MaleProfile): void {
    localStorage.setItem(this.STORAGE_KEYS.MALE_PROFILE, JSON.stringify(profile));
  }

  private getDefaultMaleProfile(): MaleProfile {
    const goodTraits: Trait[] = [
      { id: 't1', name: 'Confident', type: 'good', points: 15, category: 'mental', description: 'Self-assured and comfortable in social situations', active: true },
      { id: 't2', name: 'Good Listener', type: 'good', points: 20, category: 'social', description: 'Pays attention and remembers details', active: true },
      { id: 't3', name: 'Fit & Athletic', type: 'good', points: 10, category: 'physical', description: 'Takes care of physical health', active: false },
      { id: 't4', name: 'Financially Stable', type: 'good', points: 12, category: 'financial', description: 'Has steady income and manages money well', active: true },
      { id: 't5', name: 'Emotionally Intelligent', type: 'good', points: 18, category: 'emotional', description: 'Understands and manages emotions well', active: false },
      { id: 't6', name: 'Ambitious', type: 'good', points: 15, category: 'mental', description: 'Goal-oriented and driven', active: true },
      { id: 't7', name: 'Sense of Humor', type: 'good', points: 20, category: 'social', description: 'Can make others laugh and enjoy life', active: true },
      { id: 't8', name: 'Well-groomed', type: 'good', points: 8, category: 'physical', description: 'Takes care of appearance and hygiene', active: true }
    ];

    const badTraits: Trait[] = [
      { id: 't9', name: 'Overthinking', type: 'bad', points: -10, category: 'mental', description: 'Tends to overanalyze situations', active: true },
      { id: 't10', name: 'Shy/Introverted', type: 'bad', points: -8, category: 'social', description: 'Takes time to open up', active: false },
      { id: 't11', name: 'Workaholic', type: 'bad', points: -12, category: 'emotional', description: 'Sometimes prioritizes work too much', active: true },
      { id: 't12', name: 'Indecisive', type: 'bad', points: -7, category: 'mental', description: 'Struggles with making quick decisions', active: false },
      { id: 't13', name: 'Jealous tendencies', type: 'bad', points: -15, category: 'emotional', description: 'Can be possessive at times', active: false },
      { id: 't14', name: 'Poor texter', type: 'bad', points: -5, category: 'social', description: 'Not great at digital communication', active: true }
    ];

    const nonNegotiables: NonNegotiable[] = [
      { id: 'nn1', title: 'Loyalty', description: 'Must be faithful and committed', priority: 'critical', met: false, category: 'values' },
      { id: 'nn2', title: 'Communication', description: 'Open and honest communication', priority: 'critical', met: false, category: 'personality' },
      { id: 'nn3', title: 'Ambition', description: 'Has goals and dreams', priority: 'high', met: false, category: 'goals' },
      { id: 'nn4', title: 'Kindness', description: 'Treats others with respect', priority: 'critical', met: false, category: 'values' },
      { id: 'nn5', title: 'Chemistry', description: 'Physical and emotional attraction', priority: 'high', met: false, category: 'physical' },
      { id: 'nn6', title: 'Independence', description: 'Has own life and interests', priority: 'medium', met: false, category: 'lifestyle' },
      { id: 'nn7', title: 'Family Values', description: 'Wants similar future', priority: 'high', met: false, category: 'goals' },
      { id: 'nn8', title: 'Humor Compatibility', description: 'Can laugh together', priority: 'medium', met: false, category: 'personality' }
    ];

    return {
      id: 'male_profile_1',
      name: 'Player',
      avatar: '🤵',
      nonNegotiables,
      traits: [...goodTraits, ...badTraits],
      totalScore: this.calculateMaleScore([...goodTraits, ...badTraits]),
      attractivenessLevel: 65,
      successRate: 0,
      strengths: ['Communication', 'Humor', 'Ambition'],
      weaknesses: ['Overthinking', 'Work-life balance']
    };
  }

  private calculateMaleScore(traits: Trait[]): number {
    return traits.reduce((total, trait) => {
      return trait.active ? total + trait.points : total;
    }, 0);
  }

  updateMaleTrait(traitId: string, active: boolean): void {
    const profile = this.getMaleProfile();
    if (profile) {
      const trait = profile.traits.find(t => t.id === traitId);
      if (trait) {
        trait.active = active;
        profile.totalScore = this.calculateMaleScore(profile.traits);
        this.saveMaleProfile(profile);
      }
    }
  }

  updateNonNegotiable(nonNegotiableId: string, met: boolean): void {
    const profile = this.getMaleProfile();
    if (profile) {
      const nn = profile.nonNegotiables.find(n => n.id === nonNegotiableId);
      if (nn) {
        nn.met = met;
        this.saveMaleProfile(profile);
      }
    }
  }

  // Pickup Line Management
  getPickupLines(): PickupLine[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.PICKUP_LINES);
    return stored ? JSON.parse(stored) : [];
  }

  savePickupLines(lines: PickupLine[]): void {
    localStorage.setItem(this.STORAGE_KEYS.PICKUP_LINES, JSON.stringify(lines));
  }

  private getDefaultPickupLines(): PickupLine[] {
    return [];
  }

  addPickupLine(line: PickupLine): void {
    const lines = this.getPickupLines();
    lines.push(line);
    this.savePickupLines(lines);
  }

  updatePickupLine(lineId: string, updates: Partial<PickupLine>): void {
    const lines = this.getPickupLines();
    const line = lines.find(l => l.id === lineId);
    
    if (line) {
      Object.assign(line, updates);
      this.savePickupLines(lines);
    }
  }

  recordPickupLineReaction(lineId: string, reaction: PickupLineReaction): void {
    const lines = this.getPickupLines();
    const line = lines.find(l => l.id === lineId);
    
    if (line) {
      if (line.reactions) {
        line.reactions.push(reaction);
      } else {
        line.reactions = [reaction];
      }
      
      if (line.usedWith && !line.usedWith.includes(reaction.girlId)) {
        line.usedWith.push(reaction.girlId);
      } else if (!line.usedWith) {
        line.usedWith = [reaction.girlId];
      }
      
      // Calculate success rate
      const successfulReactions = line.reactions?.filter(r => 
        r.reaction === 'loved' || r.reaction === 'liked' || r.ledToConversation
      ).length || 0;
      line.successRate = line.reactions.length > 0 
        ? Math.round((successfulReactions / line.reactions.length) * 100)
        : 0;
      
      this.savePickupLines(lines);
    }
  }

  getBestPickupLines(): PickupLine[] {
    return this.getPickupLines()
      .sort((a, b) => (b.successRate || 0) - (a.successRate || 0))
      .slice(0, 5);
  }

  // Original Girls Management
  private getDefaultGirls(): Girl[] {
    const avatars = ['👩‍🦰', '👩‍🦱', '👩', '👱‍♀️', '👩‍🦳', '👩‍🎨', '👩‍🔬', '👩‍💼', '👩‍🎓', '👩‍🍳'];
    const names = ['Emma', 'Sophia', 'Isabella', 'Olivia', 'Ava', 'Mia', 'Charlotte', 'Luna', 'Harper', 'Ella'];
    const personalities = ['Adventurous', 'Intellectual', 'Creative', 'Ambitious', 'Free-spirited', 'Caring', 'Mysterious', 'Energetic', 'Sophisticated', 'Playful'];
    const interests = [
      ['Travel', 'Photography', 'Hiking'],
      ['Books', 'Philosophy', 'Art'],
      ['Music', 'Dancing', 'Painting'],
      ['Business', 'Technology', 'Networking'],
      ['Yoga', 'Meditation', 'Nature'],
      ['Cooking', 'Volunteering', 'Animals'],
      ['Movies', 'Gaming', 'Mysteries'],
      ['Sports', 'Fitness', 'Adventures'],
      ['Fashion', 'Wine', 'Fine dining'],
      ['Comedy', 'Parties', 'Beach']
    ];

    return names.map((name, i) => ({
      id: `girl_${i + 1}`,
      name,
      avatar: avatars[i],
      characteristics: {
        personality: personalities[i],
        interests: interests[i],
        style: ['Casual', 'Elegant', 'Sporty', 'Bohemian', 'Classic'][i % 5] as any,
        energy: ['high', 'medium', 'low'][i % 3] as 'high' | 'medium' | 'low',
        communication: ['frequent', 'moderate', 'minimal'][i % 3] as 'frequent' | 'moderate' | 'minimal'
      },
      lookingFor: {
        humor: Math.floor(Math.random() * 5) + 5,
        intelligence: Math.floor(Math.random() * 5) + 5,
        confidence: Math.floor(Math.random() * 5) + 5,
        authenticity: Math.floor(Math.random() * 5) + 5,
        adventure: Math.floor(Math.random() * 5) + 5
      },
      stats: {
        interactionCount: 0,
        lastInteraction: null,
        relationshipLevel: 0,
        mood: 'neutral' as 'neutral',
        trustLevel: 0
      },
      tournamentScore: 0,
      achievements: []
    }));
  }

  private getDefaultStats(): GameStats {
    return {
      totalInteractions: 0,
      averageRelationshipLevel: 0,
      mostInteractedGirl: null,
      currentChampion: null,
      tournamentsCompleted: 0,
      challengesCompleted: 0,
      socialSkillLevel: 1,
      charismaPoints: 0,
      confidenceLevel: 10,
      totalDatesCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalPointsEarned: 0,
      averageInteractionScore: 0
    };
  }

  // Girls Management
  getGirls(): Girl[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.GIRLS);
    const girls = stored ? JSON.parse(stored) : [];
    
    // Ensure all girls have totalPoints calculated
    let updated = false;
    girls.forEach((girl: Girl) => {
      if (girl.totalPoints === undefined) {
        girl.totalPoints = girl.interactions?.reduce((total: number, interaction: any) => total + interaction.points, 0) || 0;
        updated = true;
      }
    });
    
    if (updated) {
      this.saveGirls(girls);
    }
    
    return girls;
  }

  saveGirls(girls: Girl[]): void {
    localStorage.setItem(this.STORAGE_KEYS.GIRLS, JSON.stringify(girls));
  }

  updateGirl(girl: Girl): void {
    const girls = this.getGirls();
    const index = girls.findIndex(g => g.id === girl.id);
    if (index !== -1) {
      girls[index] = girl;
      this.saveGirls(girls);
    }
  }

  // Interactions Management
  getInteractions(): Interaction[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.INTERACTIONS);
    return stored ? JSON.parse(stored) : [];
  }

  addInteraction(interaction: Interaction): void {
    const interactions = this.getInteractions();
    interactions.push(interaction);
    localStorage.setItem(this.STORAGE_KEYS.INTERACTIONS, JSON.stringify(interactions));

    // Update girl stats
    const girls = this.getGirls();
    const girl = girls.find(g => g.id === interaction.girlId);
    if (girl) {
      // Initialize stats if not present
      if (!girl.stats) {
        girl.stats = {
          interactionCount: 0,
          lastInteraction: null,
          relationshipLevel: 0,
          mood: 'neutral',
          trustLevel: 0
        };
      }
      
      girl.stats.interactionCount++;
      girl.stats.lastInteraction = interaction.date;
      
      // Update relationship level based on interaction quality
      const qualityBonus: Record<string, number> = { great: 10, good: 5, okay: 2, poor: -5 };
      girl.stats.relationshipLevel = Math.min(100, Math.max(0, 
        girl.stats.relationshipLevel + qualityBonus[interaction.quality]));
      
      // Update mood
      if (interaction.quality === 'great') girl.stats.mood = 'happy';
      else if (interaction.quality === 'poor') girl.stats.mood = 'upset';
      
      // Update tournament score
      if (girl.tournamentScore === undefined) girl.tournamentScore = 0;
      girl.tournamentScore += interaction.points;
      
      // Update totalPoints
      if (girl.totalPoints === undefined) girl.totalPoints = 0;
      girl.totalPoints += interaction.points;
      
      this.updateGirl(girl);
    }

    // Update game stats
    this.updateGameStats();
  }

  // Tournament Management
  getTournamentRounds(): TournamentRound[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.ROUNDS);
    return stored ? JSON.parse(stored) : [];
  }

  createTournamentRound(round: TournamentRound): void {
    const rounds = this.getTournamentRounds();
    rounds.push(round);
    localStorage.setItem(this.STORAGE_KEYS.ROUNDS, JSON.stringify(rounds));
  }

  eliminateGirl(roundId: string, girlId: string): void {
    const rounds = this.getTournamentRounds();
    const round = rounds.find(r => r.id === roundId);
    if (round && !round.eliminated.includes(girlId)) {
      round.eliminated.push(girlId);
      localStorage.setItem(this.STORAGE_KEYS.ROUNDS, JSON.stringify(rounds));
    }
  }

  // Challenges Management
  getChallenges(): Challenge[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.CHALLENGES);
    return stored ? JSON.parse(stored) : [];
  }

  addChallenge(challenge: Challenge): void {
    const challenges = this.getChallenges();
    challenges.push(challenge);
    localStorage.setItem(this.STORAGE_KEYS.CHALLENGES, JSON.stringify(challenges));
  }

  completeChallenge(challengeId: string): void {
    const challenges = this.getChallenges();
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge) {
      challenge.completed = true;
      localStorage.setItem(this.STORAGE_KEYS.CHALLENGES, JSON.stringify(challenges));
      
      // Update game stats
      const stats = this.getGameStats();
      if (stats) {
        stats.challengesCompleted++;
        stats.charismaPoints += challenge.points;
        this.saveGameStats(stats);
      }
    }
  }

  // Goals Management
  getGoals(): SocialGoal[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.GOALS);
    return stored ? JSON.parse(stored) : [];
  }

  addGoal(goal: SocialGoal): void {
    const goals = this.getGoals();
    goals.push(goal);
    localStorage.setItem(this.STORAGE_KEYS.GOALS, JSON.stringify(goals));
  }

  updateGoal(goalId: string, currentValue: number): void {
    const goals = this.getGoals();
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      goal.currentValue = currentValue;
      localStorage.setItem(this.STORAGE_KEYS.GOALS, JSON.stringify(goals));
    }
  }

  // Game Stats Management
  getGameStats(): GameStats | null {
    const stored = localStorage.getItem(this.STORAGE_KEYS.STATS);
    return stored ? JSON.parse(stored) : null;
  }

  saveGameStats(stats: GameStats): void {
    localStorage.setItem(this.STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  private updateGameStats(): void {
    const girls = this.getGirls();
    const interactions = this.getInteractions();
    const stats = this.getGameStats() || this.getDefaultStats();

    stats.totalInteractions = interactions.length;
    
    if (girls.length > 0) {
      const totalRelationship = girls.reduce((sum, g) => sum + (g.stats?.relationshipLevel || 0), 0);
      stats.averageRelationshipLevel = Math.round(totalRelationship / girls.length);
      
      const mostInteracted = girls.reduce((prev, current) => 
        ((prev.stats?.interactionCount || 0) > (current.stats?.interactionCount || 0)) ? prev : current);
      stats.mostInteractedGirl = mostInteracted.id;
      
      const champion = girls.reduce((prev, current) => 
        ((prev.tournamentScore || 0) > (current.tournamentScore || 0)) ? prev : current);
      stats.currentChampion = champion.id;
    }

    // Update skill levels based on interactions
    stats.socialSkillLevel = Math.min(100, Math.floor(stats.totalInteractions / 5));
    stats.confidenceLevel = Math.min(100, 10 + Math.floor(stats.challengesCompleted * 5));

    this.saveGameStats(stats);
  }

  // Helper methods
  getTopGirls(limit: number = 3): Girl[] {
    return this.getGirls()
      .sort((a, b) => (b.tournamentScore || 0) - (a.tournamentScore || 0))
      .slice(0, limit);
  }

  getActiveRound(): TournamentRound | null {
    const rounds = this.getTournamentRounds();
    return rounds.find(r => r.active) || null;
  }

  getGirlById(id: string): Girl | undefined {
    return this.getGirls().find(g => g.id === id);
  }

  addGirl(girl: Girl): void {
    const girls = this.getGirls();
    // Ensure totalPoints is calculated
    if (girl.totalPoints === undefined) {
      girl.totalPoints = this.calculateGirlTotalPoints(girl.id);
    }
    girls.push(girl);
    this.saveGirls(girls);
  }

  private calculateGirlTotalPoints(girlId: string): number {
    const girl = this.getGirls().find(g => g.id === girlId);
    if (!girl || !girl.interactions) return 0;
    return girl.interactions.reduce((total, interaction) => total + interaction.points, 0);
  }


  // Tournament Bracket Management
  getTournamentBrackets(): TournamentBracket[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.BRACKETS);
    return stored ? JSON.parse(stored) : [];
  }

  createTournamentBracket(participantIds: string[]): TournamentBracket {
    const bracket: TournamentBracket = {
      id: Date.now().toString(),
      name: `Tournament ${new Date().toLocaleDateString()}`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      rounds: this.generateBracketRounds(participantIds),
      championId: null,
      runnerUpId: null,
      thirdPlaceId: null
    };

    const brackets = this.getTournamentBrackets();
    brackets.push(bracket);
    localStorage.setItem(this.STORAGE_KEYS.BRACKETS, JSON.stringify(brackets));
    return bracket;
  }

  private generateBracketRounds(participantIds: string[]): TournamentMatch[][] {
    const rounds: TournamentMatch[][] = [];
    let currentParticipants = [...participantIds];
    let round = 1;

    while (currentParticipants.length > 1) {
      const roundMatches: TournamentMatch[] = [];
      const nextRoundParticipants: string[] = [];

      for (let i = 0; i < currentParticipants.length; i += 2) {
        if (i + 1 < currentParticipants.length) {
          const match: TournamentMatch = {
            id: `match_${round}_${i/2}`,
            round,
            participant1Id: currentParticipants[i],
            participant2Id: currentParticipants[i + 1],
            winnerId: null,
            score1: 0,
            score2: 0,
            date: new Date(),
            completed: false
          };
          roundMatches.push(match);
        } else {
          // Bye - participant advances automatically
          nextRoundParticipants.push(currentParticipants[i]);
        }
      }
      
      rounds.push(roundMatches);
      currentParticipants = nextRoundParticipants;
      round++;
    }

    return rounds;
  }

  updateMatchResult(bracketId: string, matchId: string, winnerId: string, score1: number, score2: number): void {
    const brackets = this.getTournamentBrackets();
    const bracket = brackets.find(b => b.id === bracketId);
    
    if (bracket) {
      for (let round of bracket.rounds) {
        const match = round.find(m => m.id === matchId);
        if (match) {
          match.winnerId = winnerId;
          match.score1 = score1;
          match.score2 = score2;
          match.completed = true;
          break;
        }
      }
      localStorage.setItem(this.STORAGE_KEYS.BRACKETS, JSON.stringify(brackets));
    }
  }

  // Date Plan Management
  getDatePlans(): DatePlan[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.DATE_PLANS);
    return stored ? JSON.parse(stored) : [];
  }

  addDatePlan(plan: DatePlan): void {
    const plans = this.getDatePlans();
    plans.push(plan);
    localStorage.setItem(this.STORAGE_KEYS.DATE_PLANS, JSON.stringify(plans));
  }

  updateDatePlan(planId: string, updates: Partial<DatePlan>): void {
    const plans = this.getDatePlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex !== -1) {
      plans[planIndex] = { ...plans[planIndex], ...updates };
      localStorage.setItem(this.STORAGE_KEYS.DATE_PLANS, JSON.stringify(plans));
    }
  }

  getUpcomingDates(): DatePlan[] {
    return this.getDatePlans()
      .filter(p => p.status === 'planned' && new Date(p.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}