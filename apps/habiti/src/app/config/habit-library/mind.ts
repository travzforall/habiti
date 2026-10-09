import { LibrarySection, group, habit, sub } from './types';

/**
 * Attention, mood and the practices that keep both steady.
 *
 * The `meditation` subcategory was removed deliberately, along with its five
 * habits — Meditate 10 minutes, Body scan, Walking meditation, Loving-kindness
 * (metta) and Noting practice (vipassana). Habiti does not recommend
 * contemplative or new-age practice.
 *
 * Removing a habit id is not free: `pick()` throws on an unknown id, so any
 * pack that referenced one had to be rewritten in the same change (Calm Mind
 * was the only one). Users who had already added those habits keep them —
 * `libraryHabitByName` simply returns undefined and the guidance panel and
 * tracking spec fall back to defaults, which they already do for hand-written
 * habits.
 */

const CAT = 'mind';

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
    tags: ['faith', 'stillness']
  }),
  habit('daily-devotional', 'Daily devotional', '📖', 'A short reading and a moment to sit with it.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'reading',
    tags: ['faith', 'scripture'],
    guidance: {
      summary: 'A fixed, short reading beats an open-ended one you keep postponing.',
      steps: [
        'Pick a plan or a book and read the passage for the day.',
        'Sit with one verse rather than trying to cover ground.',
        'Write a line on what it asked of you.'
      ],
      tips: ['Same time and same chair each day does more for this than willpower.']
    }
  }),
  habit('pray-with-family', 'Pray with family', '🙏', 'Together, out loud, before the day scatters.', {
    points: 10,
    goal: 1,
    unit: 'time',
    tags: ['faith', 'family']
  }),
  habit('memorise-verse', 'Memorise a verse', '🧠', 'One a week, carried rather than looked up.', {
    difficulty: 'medium',
    points: 15,
    goal: 1,
    unit: 'verse',
    tags: ['faith', 'scripture']
  }),
  habit('examen', 'Evening examen', '🌙', 'Where the day went well, and where it did not.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['faith', 'reflection']
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
      // The 'meditation' subcategory was removed along with its five habits —
      // see the note at the top of this file. Breathing survives it: box
      // breathing and the physiological sigh are physiological techniques with
      // no spiritual framing, and they are what the Calm Mind pack now leans on.
      sub('breathing', 'Breathing', '🌬️', 'Fast tools for stress in the moment.'),
      sub('journaling', 'Journaling', '📓', 'Writing, gratitude and reflection.'),
      sub('emotional', 'Emotional health', '💗', 'Support, triggers and digital hygiene.'),
      sub('faith', 'Faith & prayer', '🙏', 'Prayer, scripture and stillness.')
    ]
  },
  habits: [...breathing, ...journaling, ...emotional, ...faith]
};
