import { LibrarySection, group, habit, sub } from './types';

/** Attention, mood and the practices that keep both steady. */

const CAT = 'mind';

const meditation = group(CAT, 'meditation', [
  habit('meditate-10', 'Meditate 10 minutes', '🧘', 'Guided or silent, both count.', {
    tracking: { kind: 'duration', unit: 'minutes', target: 10, direction: 'at-least', step: 1, min: 0 },
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['meditation'],
    guidance: {
      summary: 'The practice is noticing you have wandered and coming back. That IS the exercise.',
      steps: [
        'Sit upright somewhere you will not be interrupted.',
        'Set a timer so you are not clock-watching.',
        'Rest attention on the breath where you feel it most clearly.',
        'When you notice you have drifted, return to the breath without judging it.'
      ],
      mistakes: [
        'Believing you are failing because your mind wanders — that is the whole point.',
        'Starting at 30 minutes and quitting by Thursday.'
      ],
      tips: ['Two minutes daily beats twenty minutes once a week.']
    }
  }),
  habit('body-scan', 'Body scan', '🫧', 'Attention through the body, head to toe.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['meditation', 'relaxation']
  }),
  habit('walking-meditation', 'Walking meditation', '🚶', 'Slow, deliberate, attention on each step.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['meditation', 'movement']
  }),
  habit('loving-kindness', 'Loving-kindness practice', '💗', 'Goodwill, starting with yourself.', {
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['meditation', 'compassion']
  }),
  habit('noting-practice', 'Noting practice', '🏷️', 'Name what arises: thinking, hearing, feeling.', {
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['meditation']
  })
]);

const breathing = group(CAT, 'breathing', [
  habit('box-breathing', 'Box breathing', '🌬️', 'In 4, hold 4, out 4, hold 4.', {
    difficulty: 'easy',
    points: 5,
    goal: 2,
    unit: 'minutes',
    tags: ['breathing', 'stress'],
    guidance: {
      summary: 'Two minutes resets a stressed afternoon and nobody can tell you are doing it.',
      steps: [
        'Breathe in through the nose for a count of four.',
        'Hold for four.',
        'Out through the mouth for four.',
        'Hold empty for four. Repeat.'
      ]
    }
  }),
  habit('physiological-sigh', 'Physiological sigh', '😮‍💨', 'Two inhales, one long exhale.', {
    difficulty: 'easy',
    points: 5,
    goal: 3,
    unit: 'times',
    tags: ['breathing', 'stress'],
    guidance: { summary: 'The fastest way down from acute stress — works in about thirty seconds.' }
  }),
  habit('nasal-breathing', 'Breathe through the nose', '👃', 'Especially during easy cardio.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['breathing']
  }),
  habit('breath-before-reacting', 'One breath before reacting', '⏸️', 'The gap between trigger and response.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['breathing', 'emotional'],
    guidance: { summary: 'The single highest-leverage habit for arguments you later regret.' }
  })
]);

const journaling = group(CAT, 'journaling', [
  habit('journal', 'Journal for 10 minutes', '📓', 'Unedited and unread.', {
    tracking: { kind: 'duration', unit: 'minutes', target: 10, direction: 'at-least', step: 5, min: 0 },
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['journaling'],
    guidance: {
      summary: 'Writing badly about something is how you find out what you think about it.',
      tips: ['Stuck? Start with "What I keep avoiding is…" and keep the pen moving.']
    }
  }),
  habit('morning-pages', 'Morning pages', '📝', 'Three pages, longhand, first thing.', {
    difficulty: 'hard',
    points: 15,
    goal: 3,
    unit: 'pages',
    tags: ['journaling', 'creative']
  }),
  habit('gratitude', 'Write 3 things you are grateful for', '🙏', 'Specific ones, not general.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'things',
    tags: ['gratitude'],
    guidance: {
      summary: '"My brother called" works. "My family" stops working within a week.',
      mistakes: ['Repeating the same generic list until it means nothing']
    }
  }),
  habit('evening-reflection', 'Reflect on the day', '🌆', 'What went well, what did not.', {
    difficulty: 'easy',
    points: 10,
    goal: 5,
    unit: 'minutes',
    tags: ['journaling', 'review']
  }),
  habit('note-the-trigger', 'Note the trigger', '📌', 'Name what made today hard.', {
    difficulty: 'easy',
    points: 10,
    goal: 5,
    unit: 'minutes',
    tags: ['journaling', 'emotional', 'sobriety']
  }),
  habit('worry-window', 'Worry window', '⏳', 'Ten scheduled minutes, then done.', {
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['emotional', 'stress'],
    guidance: {
      summary: 'Containing worry to a set time works better than trying not to worry.'
    }
  })
]);

const emotional = group(CAT, 'emotional', [
  habit('therapy-session', 'Therapy session', '💬', 'Attend and engage.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['emotional', 'support']
  }),
  habit('support-group', 'Support group', '🤝', 'Show up, whatever kind of week it was.', {
    points: 20,
    goal: 1,
    unit: 'meeting',
    tags: ['emotional', 'sobriety', 'support']
  }),
  habit('name-the-feeling', 'Name the feeling', '🏷️', 'Put a word on it before acting.', {
    tracking: { kind: 'rating', target: 3, direction: 'at-least', min: 1, max: 5, prompt: 'How was your mood?' },
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['emotional'],
    guidance: { summary: 'Naming an emotion reliably lowers its intensity.' }
  }),
  habit('no-doomscrolling', 'No doomscrolling', '📰', 'Stop the anxious news loop.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['emotional', 'digital', 'avoid']
  }),
  habit('no-comparison', 'No comparing yourself online', '📊', 'Their highlight reel is not your day.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['emotional', 'digital', 'avoid']
  }),
  habit('ask-for-help', 'Ask for help', '🆘', 'Say the thing out loud to someone.', {
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'time',
    tags: ['emotional', 'social']
  }),
  habit('digital-sunset', 'Digital sunset', '🌇', 'Devices down at a set hour.', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['digital', 'sleep']
  }),
  habit('single-tasking', 'Do one thing at a time', '1️⃣', 'No second screen.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['attention']
  })
]);

const faith = group(CAT, 'faith', [
  habit('pray', 'Pray', '🙏', 'However you practise.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['faith']
  }),
  habit('read-scripture', 'Read scripture', '📖', 'A passage a day.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['faith', 'reading']
  }),
  habit('attend-service', 'Attend a service', '⛪', 'Being there in person.', {
    points: 15,
    goal: 1,
    unit: 'service',
    tags: ['faith', 'community']
  }),
  habit('reflection-silence', 'Sit in silence', '🕯️', 'No input, no output.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['faith', 'meditation']
  })
]);

export const MIND: LibrarySection = {
  category: {
    id: CAT,
    name: 'Mind & Wellbeing',
    icon: '🧘',
    description: 'Attention, mood, and the practices that steady both.',
    accent: 'from-violet-400 to-purple-600',
    subcategories: [
      sub('meditation', 'Meditation', '🧘', 'Sitting, walking and compassion practice.'),
      sub('breathing', 'Breathing', '🌬️', 'Fast tools for stress in the moment.'),
      sub('journaling', 'Journaling', '📓', 'Writing, gratitude and reflection.'),
      sub('emotional', 'Emotional health', '💗', 'Support, triggers and digital hygiene.'),
      sub('faith', 'Faith & reflection', '🕯️', 'Prayer, scripture and stillness.')
    ]
  },
  habits: [...meditation, ...breathing, ...journaling, ...emotional, ...faith]
};
