import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Mind & Practice — the skills that make the other skills possible. */

const CAT = 'mind';

const skills = inCategory(CAT, [
  /**
   * RETIRED, not deleted.
   *
   * Habiti no longer recommends meditation, but `SkillTrack.skillId` is stored
   * per user: deleting this entry would orphan anyone already on the track, and
   * `skillDefinition()` throws on an unknown id by design. `active: false`
   * removes it from every listing (`skillsInCategory` filters on it) while
   * existing tracks still resolve.
   *
   * habitIds had to be pruned to ids that still exist. `practiceHabits()`
   * resolves them through the library's THROWING `pick()`, so a retired skill
   * still holding a dead id crashes the skills page — inactive does not mean
   * unevaluated.
   */
  skill({
    id: 'meditation',
    active: false,
    name: 'Meditation',
    icon: '🧘',
    description: 'Noticing you have wandered and coming back. That is the whole exercise.',
    habitIds: ['box-breathing'],
    starterTasks: [
      task('same-time', 'Fix a time and place', 'Deciding daily is what kills the habit.', 'high'),
      task('short-first', 'Start at five minutes, not thirty', 'Thirty is how people quit by Thursday.')
    ],
    starterProjects: [
      project('thirty-days-sitting', 'Sit every day for thirty days', 'Length does not matter. Consecutive does.', [
        'Choose a time and a length',
        'Sit daily for thirty days',
        'Write one line about what changed'
      ])
    ],
    campaignTemplateIds: ['quiet-mind-21'],
    // Sorted last; it shared slot 1 with Prayer, which now owns it.
    sortIndex: 99,
    tiers: [
      tier(1, 'Sitting most days, however briefly.', [req.days(7)]),
      tier(2, 'A fixed time and place, and it happens without deciding.', [req.days(30), req.tasks('same-time')]),
      tier(3, 'A full month unbroken, and you notice the difference off the cushion.', [
        req.days(90),
        req.volume(600, 'minutes', ['box-breathing']),
        req.project('thirty-days-sitting')
      ]),
      tier(4, 'Attention is a thing you can direct under stress.', [
        req.days(180),
        req.streak(21),
        req.campaign('quiet-mind-21')
      ]),
      tier(5, 'Practice, not project. It is simply part of the day.', [
        req.days(365),
        req.volume(4000, 'minutes', ['box-breathing'])
      ])
    ]
  }),

  skill({
    id: 'prayer',
    name: 'Prayer',
    icon: '🙏',
    description: 'A rhythm you keep on the days you do not feel like it.',
    habitIds: [
      'pray',
      'read-scripture',
      'daily-devotional',
      'pray-with-family',
      'examen',
      'memorise-verse',
      'attend-service',
      'reflection-silence'
    ],
    starterTasks: [
      task('fixed-hour', 'Fix an hour, not an intention', 'A time you keep beats a resolve you renew.', 'high'),
      task('plan-chosen', 'Choose a reading plan', 'So the decision is made once, not daily.')
    ],
    starterProjects: [
      project('through-a-gospel', 'Read a gospel end to end', 'A chapter at a time, in order.', [
        'Pick one gospel',
        'Read a chapter a day',
        'Write a line on what each chapter asked of you'
      ])
    ],
    campaignTemplateIds: ['quiet-mind-21'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Praying most days, however briefly.', [req.days(7)]),
      tier(2, 'A fixed time, and it happens without deciding.', [req.days(30), req.tasks('fixed-hour')]),
      tier(3, 'Scripture alongside prayer, and a gospel read through.', [
        req.days(90),
        req.project('through-a-gospel')
      ]),
      tier(4, 'It holds on the hard weeks, not just the easy ones.', [req.days(180), req.streak(21)]),
      tier(5, 'Not a practice you keep. Simply part of the day.', [req.days(365)])
    ]
  }),

  skill({
    id: 'journaling',
    name: 'Journaling',
    icon: '📓',
    description: 'Writing badly about something is how you find out what you think.',
    habitIds: ['journal', 'morning-pages', 'gratitude', 'evening-reflection', 'note-the-trigger'],
    starterTasks: [
      task('no-audience', 'Write one entry nobody will read', 'Honesty is the point; an audience removes it.', 'high'),
      task('prompt-set', 'Keep three prompts to hand', 'For the days when the page is blank.')
    ],
    starterProjects: [
      project('month-of-pages', 'Journal every day for a month', 'Unedited, unread, undeleted.', [
        'Pick a time of day',
        'Write daily for thirty days',
        'Read the first entry again at the end'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'quiet-mind-21'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Putting words down regularly.', [req.days(7)]),
      tier(2, 'Writing honestly rather than performing.', [req.days(30), req.tasks('no-audience')]),
      tier(3, 'A month of pages and a record worth rereading.', [req.days(90), req.project('month-of-pages')]),
      tier(4, 'Journalling is where you actually solve things.', [req.days(180), req.streak(21)]),
      tier(5, 'Years of pages. You can see yourself change across them.', [req.days(365)])
    ]
  }),

  skill({
    id: 'deep-reading',
    name: 'Deep Reading',
    icon: '📚',
    description: 'Reading whole books properly, not feeds endlessly.',
    habitIds: ['read-30', 'read-before-bed', 'take-notes', 'teach-someone'],
    starterTasks: [
      task('finish-one', 'Finish one book you started and abandoned', 'The habit is finishing, not starting.', 'high'),
      task('own-words', 'Write one paragraph in your own words', 'Copying a quote is not learning.')
    ],
    starterProjects: [
      project('twelve-books', 'Read twelve books in a year', 'One a month. Notes on each.', [
        'Choose the first three',
        'Read one a month',
        'Keep a note on each'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Reading daily, even briefly.', [req.days(7)]),
      tier(2, 'Finishing what you start.', [req.days(30), req.tasks('finish-one')]),
      tier(3, 'Notes in your own words, and you can explain what you read.', [
        req.days(90),
        req.volume(1800, 'minutes', ['read-30']),
        req.tasks('own-words')
      ]),
      tier(4, 'A year of steady reading.', [req.days(180), req.project('twelve-books')]),
      tier(5, 'Reading is how you think, not a thing you schedule.', [
        req.days(365),
        req.volume(7000, 'minutes', ['read-30'])
      ])
    ]
  }),

  skill({
    id: 'memory',
    name: 'Memory',
    icon: '🧠',
    description: 'Spaced repetition, done consistently, is close to a superpower.',
    habitIds: ['spaced-repetition', 'take-notes', 'teach-someone'],
    starterTasks: [
      task('one-deck', 'Build one deck of fifty cards', 'One subject. Small enough to actually review.', 'high'),
      task('review-daily', 'Review every day for two weeks', 'Spaced repetition only works if it is daily.')
    ],
    starterProjects: [
      project('learn-a-set', 'Memorise something useful', 'A hundred words, the periodic table, a speech.', [
        'Choose the material',
        'Build the deck',
        'Review daily until recall is reliable'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Reviewing regularly.', [req.days(7)]),
      tier(2, 'A deck that fits your life rather than one you dread.', [req.days(30), req.tasks('one-deck')]),
      tier(3, 'Something genuinely memorised.', [req.days(90), req.project('learn-a-set')]),
      tier(4, 'Recall holds months later, not days.', [req.days(180), req.streak(21)]),
      tier(5, 'Learning anything is now a solved process.', [req.days(365)])
    ]
  }),

  skill({
    id: 'sleep',
    name: 'Sleep',
    icon: '😴',
    description: 'The habit that makes every other habit easier.',
    habitIds: ['sleep-7-hours', 'same-wake-time', 'lights-out', 'no-screens-before-bed', 'wind-down', 'cool-dark-room', 'limit-caffeine'],
    starterTasks: [
      task('fix-wake', 'Fix the wake time first', 'Everything else hangs off this one anchor.', 'high'),
      task('caffeine-cut', 'Move your last coffee to before 2pm', 'It has a five-hour half-life.')
    ],
    starterProjects: [
      project('sleep-reset', 'A two-week sleep reset', 'Same wake time, no screens late, room dark and cool.', [
        'Set one wake time for all seven days',
        'Build a wind-down routine',
        'Hold it for fourteen days'
      ])
    ],
    campaignTemplateIds: ['quiet-mind-21', 'no-zero-days-14'],
    sortIndex: 5,
    tiers: [
      tier(1, 'Paying attention to sleep at all.', [req.days(7)]),
      tier(2, 'A consistent wake time, weekends included.', [req.days(30), req.tasks('fix-wake')]),
      tier(3, 'Two weeks of genuinely good sleep, and you can feel it.', [req.days(90), req.project('sleep-reset')]),
      tier(4, 'Sleep survives travel and busy weeks.', [req.days(180), req.streak(21)]),
      tier(5, 'Sleeping well is simply what you do.', [req.days(365)])
    ]
  }),

  skill({
    id: 'emotional-regulation',
    name: 'Emotional Regulation',
    icon: '💗',
    description: 'The gap between what happens and how you respond.',
    habitIds: ['name-the-feeling', 'breath-before-reacting', 'worry-window', 'journal', 'therapy-session'],
    starterTasks: [
      task('name-three', 'Name the feeling three times this week', 'Naming an emotion reliably lowers its intensity.', 'high'),
      task('one-pause', 'Take one breath before responding once a day', 'The highest-leverage habit for arguments you later regret.')
    ],
    starterProjects: [
      project('trigger-log', 'Keep a trigger log for a month', 'What set it off, what you did, what you would do next time.', [
        'Note each trigger as it happens',
        'Review weekly for patterns',
        'Choose one pattern to change'
      ])
    ],
    campaignTemplateIds: ['quiet-mind-21'],
    sortIndex: 6,
    tiers: [
      tier(1, 'Noticing what you feel as it happens.', [req.days(7)]),
      tier(2, 'Naming it, which is most of the work.', [req.days(30), req.tasks('name-three')]),
      tier(3, 'A month of patterns you can actually see.', [req.days(90), req.project('trigger-log')]),
      tier(4, 'A pause between trigger and response, most of the time.', [
        req.days(180),
        req.tasks('one-pause'),
        req.campaign('quiet-mind-21')
      ]),
      tier(5, 'Steady under pressure, and people notice.', [req.days(365)])
    ]
  })
]);

export const MIND: SkillSection = {
  category: {
    id: CAT,
    name: 'Mind & Practice',
    icon: '🧘',
    description: 'Attention, memory, sleep and steadiness.',
    accent: 'from-violet-400 to-purple-600'
  },
  skills
};
