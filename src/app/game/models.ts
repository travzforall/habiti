export interface Girl {
  id: string;
  name: string;
  avatar: string;
  age?: number;
  location?: string;
  profession?: string;
  hobbies?: string[];
  lookingFor?: string[] | {
    humor: number; // 1-10
    intelligence: number; // 1-10
    confidence: number; // 1-10
    authenticity: number; // 1-10
    adventure: number; // 1-10
  };
  dealBreakers?: string[];
  totalPoints?: number;
  interactions?: Interaction[];
  characteristics?: {
    personality: string;
    interests: string[];
    style: string;
    energy: 'high' | 'medium' | 'low';
    communication: 'frequent' | 'moderate' | 'minimal';
  };
  stats?: {
    interactionCount: number;
    lastInteraction: Date | null;
    relationshipLevel: number; // 0-100
    mood: 'happy' | 'neutral' | 'upset' | 'excited';
    trustLevel: number; // 0-100
  };
  tournamentScore?: number;
  achievements?: string[];
}

export interface Interaction {
  id: string;
  girlId: string;
  date: Date;
  type: 'conversation' | 'date' | 'message' | 'call' | 'gift' | 'activity';
  description: string;
  duration?: number; // in minutes
  quality: 'great' | 'good' | 'okay' | 'poor';
  points: number;
  notes?: string;
  location?: string;
  mood?: 'happy' | 'romantic' | 'fun' | 'serious' | 'awkward';
}

export interface TournamentRound {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  participants: string[]; // girl IDs
  eliminated: string[]; // girl IDs
  active: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  targetGirlId?: string; // optional, can be for specific girl or general
  points: number;
  completed: boolean;
  deadline?: Date;
  type: 'social' | 'personal' | 'romantic' | 'adventure';
}

export interface SocialGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: Date;
  reward: string;
}

export interface GameStats {
  totalInteractions: number;
  averageRelationshipLevel: number;
  mostInteractedGirl: string | null;
  currentChampion: string | null;
  tournamentsCompleted: number;
  challengesCompleted: number;
  socialSkillLevel: number; // 1-100
  charismaPoints: number;
  confidenceLevel: number; // 1-100
  totalDatesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalPointsEarned: number;
  averageInteractionScore: number;
}

export interface MaleProfile {
  id: string;
  name: string;
  avatar: string;
  nonNegotiables: NonNegotiable[];
  traits: Trait[];
  totalScore: number;
  attractivenessLevel: number; // 1-100
  successRate: number; // percentage
  strengths: string[];
  weaknesses: string[];
}

export interface NonNegotiable {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  met: boolean;
  category: 'values' | 'lifestyle' | 'personality' | 'physical' | 'goals';
}

export interface Trait {
  id: string;
  name: string;
  type: 'good' | 'bad';
  points: number;
  category: 'physical' | 'mental' | 'emotional' | 'social' | 'financial';
  description: string;
  active: boolean;
}

export interface TournamentMatch {
  id: string;
  round: number;
  participant1Id: string;
  participant2Id: string;
  winnerId: string | null;
  score1: number;
  score2: number;
  date: Date;
  completed: boolean;
}

export interface TournamentBracket {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  rounds: TournamentMatch[][];
  championId: string | null;
  runnerUpId: string | null;
  thirdPlaceId: string | null;
}

export interface DatePlan {
  id: string;
  girlId: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  time: string;
  duration: number; // in minutes
  budget: number;
  activities: string[];
  outfit: string;
  topics: string[];
  goals: string[];
  backupPlan: string;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  rating?: number; // 1-5 stars
  notes?: string;
}

export interface PickupLine {
  id: string;
  text: string;
  line?: string; // legacy support
  category: 'funny' | 'cute' | 'clever' | 'bold' | 'casual' | 'romantic' | 'cheesy' | 'nerdy';
  girlId?: string;
  context?: string;
  notes?: string;
  dateCreated: Date;
  timesUsed: number;
  rating?: number; // 1-5 stars
  feedback?: string;
  usedWith?: string[]; // girl IDs
  successRate?: number; // percentage
  reactions?: PickupLineReaction[];
  riskLevel?: 'safe' | 'moderate' | 'risky';
}

export interface PickupLineReaction {
  girlId: string;
  date: Date;
  reaction: 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';
  response: string;
  ledToConversation: boolean;
  notes?: string;
}