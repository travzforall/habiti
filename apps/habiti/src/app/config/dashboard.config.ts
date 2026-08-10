/**
 * Dashboard configuration
 * Centralized configuration for dashboard colors, icons, and settings
 */

// Category colors for habits
export const CATEGORY_COLORS: Record<string, string> = {
  health: '#10b981',
  productivity: '#3b82f6',
  learning: '#8b5cf6',
  social: '#ec4899',
  mindfulness: '#6366f1',
  creativity: '#f97316',
  finance: '#eab308',
  other: '#6b7280'
};

// Category icons for habits
export const CATEGORY_ICONS: Record<string, string> = {
  health: '💪',
  productivity: '⚡',
  learning: '📚',
  social: '👥',
  mindfulness: '🧘',
  creativity: '🎨',
  finance: '💰',
  other: '📌'
};

// Priority colors for tasks
export const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626'
};

// Day names
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Dashboard settings
export const DASHBOARD_CONFIG = {
  // Auto-refresh interval in milliseconds (5 minutes)
  autoRefreshInterval: 5 * 60 * 1000,

  // Debounce time for habit toggle in milliseconds
  toggleDebounceTime: 300,

  // Maximum number of habits to show in dashboard grid before scroll
  maxVisibleHabits: 12,

  // Size of a points milestone. Points no longer drive level — levels come
  // from the level ledger — but the dashboard still shows progress toward the
  // next round 100 points.
  pointsPerMilestone: 100,

  // Streak milestones
  streakMilestones: {
    first: 3,
    weekly: 7,
    twoWeeks: 14,
    monthly: 30
  }
};

// Keyboard shortcuts
// These are matched against KeyboardEvent.key, so they must be key VALUES.
// The spacebar's key is a literal space — 'Space' is its `code`, and using it
// here meant the toggle shortcut silently never fired.
export const KEYBOARD_SHORTCUTS = {
  toggleHabit: ' ',
  nextHabit: 'ArrowDown',
  prevHabit: 'ArrowUp',
  refresh: 'r',
  goToHabits: 'h',
  goToTasks: 't',
  goToAnalytics: 'a'
};

// Helper functions
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS['other'];
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || '#6b7280';
}

export function formatDateShort(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function formatDateFull(date: Date): string {
  return `${MONTH_NAMES_FULL[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function getStartOfWeek(date: Date, offset: number = 0): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day + (offset * 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getWeekDates(startOfWeek: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}
