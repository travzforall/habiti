import { LibrarySection, group, habit, sub } from './types';

/** Focus, learning and making things. */

const CAT = 'work';

const deepWork = group(CAT, 'deep-work', [
  habit('deep-work-block', 'One 90-minute deep work block', '🎯', 'No messages, no tabs, one task.', {
    difficulty: 'hard',
    points: 20,
    goal: 90,
    unit: 'minutes',
    tags: ['focus', 'productivity'],
    guidance: {
      summary: 'One protected block beats a whole day of fragmented attention.',
      steps: [
        'Pick the task the night before, so no decision is needed cold.',
        'Put the phone in another room — not face down on the desk.',
        'Close mail and chat entirely; notifications off is not enough.',
        'Set a timer and stop when it ends, even mid-flow.'
      ],
      mistakes: [
        'Starting with email "just to clear it" — the block never happens.',
        'Keeping chat open on a second monitor.'
      ]
    }
  }),
  habit('pomodoro', 'Pomodoro sessions', '🍅', '25 minutes on, 5 off.', {
    points: 10,
    goal: 4,
    unit: 'sessions',
    tags: ['focus', 'productivity']
  }),
  habit('phone-in-other-room', 'Phone in another room', '📵', 'Out of reach while working.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['focus', 'avoid']
  }),
  habit('no-social-during-work', 'No social media during work', '📱', 'The biggest single recovery of hours.', {
    type: 'bad',
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'day',
    tags: ['focus', 'avoid']
  }),
  habit('one-tab', 'Work in one tab', '🗂️', 'Close everything not in use.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['focus']
  }),
  habit('no-meetings-morning', 'Protect the morning', '🌅', 'No meetings before noon.', {
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['focus', 'boundaries']
  }),
  habit('hardest-first', 'Hardest task first', '⛰️', 'Before anything easier.', {
    points: 15,
    goal: 1,
    unit: 'task',
    tags: ['focus', 'productivity'],
    guidance: { summary: 'Whatever you do first is what actually gets your best attention.' }
  })
]);

const planning = group(CAT, 'planning', [
  habit('top-three', 'Plan the top 3 tasks', '📝', 'Decide the day before it decides for you.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'tasks',
    tags: ['planning'],
    guidance: {
      summary: 'Three is the number. A list of twelve is a wish, not a plan.'
    }
  }),
  habit('time-block', 'Time-block the day', '📅', 'Give every hour a job.', {
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['planning']
  }),
  habit('weekly-review', 'Weekly review', '🗓️', 'Look back, then plan forward.', {
    points: 20,
    goal: 30,
    unit: 'minutes',
    tags: ['planning', 'review'],
    guidance: {
      summary: 'The habit that keeps every other system from quietly rotting.',
      steps: [
        'Empty every inbox — mail, notes, paper.',
        'Review last week: what moved, what did not.',
        'Check the calendar two weeks ahead.',
        'Choose next week\'s three priorities.'
      ]
    }
  }),
  habit('review-day', 'Review the day', '🌆', 'Five minutes to close the loop.', {
    difficulty: 'easy',
    points: 10,
    goal: 5,
    unit: 'minutes',
    tags: ['planning', 'review']
  }),
  habit('inbox-zero', 'Inbox to zero', '📥', 'Once a day, not continuously.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['planning', 'email'],
    guidance: { tips: ['Twice a day at set times beats checking constantly.'] }
  }),
  habit('capture-everything', 'Capture every task', '🧠', 'Out of your head, into the system.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['planning']
  }),
  habit('say-no', 'Say no to one thing', '🚫', 'Protect the commitments you already made.', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['boundaries', 'planning']
  }),
  habit('finish-before-starting', 'Finish before starting', '✅', 'Close one thing before opening another.', {
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['productivity']
  }),
  habit('no-zero-day', 'No zero day', '📈', 'Some progress beats none.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['productivity', 'consistency']
  })
]);

const learning = group(CAT, 'learning', [
  habit('read-30', 'Read for 30 minutes', '📖', 'Books, papers, long-form — not feeds.', {
    difficulty: 'easy',
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['reading', 'learning']
  }),
  habit('read-before-bed', 'Read before bed', '🛏️', 'Paper, not a screen.', {
    difficulty: 'easy',
    points: 10,
    goal: 20,
    unit: 'minutes',
    tags: ['reading', 'sleep']
  }),
  habit('take-notes', 'Take notes on what you read', '✍️', 'In your own words.', {
    points: 15,
    goal: 1,
    unit: 'note',
    tags: ['learning'],
    guidance: {
      summary: 'Copying a quote is not learning. Rewriting the idea in your own words is.'
    }
  }),
  habit('practise-language', 'Practise a language', '🗣️', 'Fifteen minutes daily beats two hours weekly.', {
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['language', 'learning']
  }),
  habit('language-speaking', 'Speak with a native speaker', '💬', 'The part that actually builds fluency.', {
    difficulty: 'hard',
    points: 20,
    goal: 20,
    unit: 'minutes',
    tags: ['language', 'social']
  }),
  habit('course-lesson', 'Work through a course', '🎓', 'One lesson at a time.', {
    points: 15,
    goal: 45,
    unit: 'minutes',
    tags: ['learning']
  }),
  habit('deliberate-practice', 'Deliberate practice', '🎯', 'Work at the edge of your ability.', {
    difficulty: 'hard',
    points: 20,
    goal: 30,
    unit: 'minutes',
    tags: ['learning', 'practice'],
    guidance: {
      summary: 'Practice that feels comfortable is not practice — it is repetition.',
      tips: ['Pick the specific thing you are bad at and work only on that.']
    }
  }),
  habit('teach-someone', 'Explain it to someone', '👨‍🏫', 'Teaching is how you find the gaps.', {
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['learning']
  }),
  habit('spaced-repetition', 'Review flashcards', '🃏', 'Spaced repetition, daily.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['learning', 'memory']
  }),
  habit('watch-lecture', 'Watch a lecture or talk', '🎥', 'Actively, with notes.', {
    difficulty: 'easy',
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['learning']
  })
]);

const creative = group(CAT, 'creative', [
  habit('write-500', 'Write 500 words', '✍️', 'Anything. Quantity produces quality.', {
    points: 15,
    goal: 500,
    unit: 'words',
    tags: ['writing', 'creative'],
    guidance: {
      summary: 'Write badly and fix later — editing while drafting is why people stall.'
    }
  }),
  habit('practise-instrument', 'Practise an instrument', '🎸', 'Twenty focused minutes.', {
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['music', 'creative'],
    guidance: { tips: ['Slow and clean beats fast and sloppy. Speed follows accuracy.'] }
  }),
  habit('sketch', 'Sketch something', '✏️', 'Ten minutes, no erasing.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['art', 'creative']
  }),
  habit('take-photos', 'Take a photograph', '📷', 'One deliberate shot.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'photo',
    tags: ['art', 'creative']
  }),
  habit('ship-something', 'Ship one small thing', '🚀', 'Finished beats perfect.', {
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'thing',
    tags: ['creative', 'making'],
    guidance: { summary: 'Publishing something imperfect teaches more than polishing forever.' }
  }),
  habit('side-project', 'Work on the side project', '🛠️', 'Thirty minutes counts.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['creative', 'making']
  }),
  habit('make-music', 'Make music', '🎹', 'Write, record or produce.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['music', 'creative']
  }),
  habit('singing-practice', 'Sing', '🎤', 'Warm up, then work on one song.', {
    points: 10,
    goal: 20,
    unit: 'minutes',
    tags: ['music', 'creative'],
    guidance: {
      summary: 'Never sing hard cold — five minutes of warm-up protects the voice you are training.',
      mistakes: ['Pushing for notes outside your range', 'Skipping the warm-up when short of time']
    }
  }),
  habit('painting-practice', 'Paint', '🎨', 'Studies or a piece in progress.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['art', 'creative'],
    guidance: {
      summary: 'Most colour problems are value problems. A quick greyscale study first saves the painting.'
    }
  }),
  habit('woodworking-practice', 'Woodworking', '🪵', 'Time at the bench.', {
    points: 15,
    goal: 45,
    unit: 'minutes',
    tags: ['making', 'creative'],
    guidance: {
      safety: 'Sharp tools cut cleanly and slip less than blunt ones. Guards on, fingers behind the blade.',
      tips: ['Mill the stock square before anything else — every later error compounds from this.']
    }
  }),
  habit('sewing-practice', 'Sewing or knitting', '🧵', 'Making or mending.', {
    difficulty: 'easy',
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['making', 'creative']
  }),
  habit('public-speaking-practice', 'Practise speaking', '🎙️', 'Out loud, on your feet, timed.', {
    points: 15,
    goal: 15,
    unit: 'minutes',
    tags: ['communication', 'practice'],
    guidance: {
      summary: 'Rehearse standing up and out loud. Reading it in your head is a different skill entirely.',
      mistakes: ['Memorising word for word — it collapses the moment you lose your place']
    }
  }),
  habit('design-practice', 'Design work', '🎨', 'Layout, type, colour — deliberate practice.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['design', 'creative']
  }),
  habit('negotiation-practice', 'Practise negotiating', '🤝', 'Prepare, role-play, or debrief a real one.', {
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['communication', 'career']
  }),
  habit('data-practice', 'Work with data', '📊', 'A dataset, a question, an answer.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['analysis', 'learning']
  }),
  habit('chess-practice', 'Chess', '♟️', 'Play, then review the game you just played.', {
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['games', 'practice'],
    guidance: { summary: 'Reviewing your own losses teaches more than playing three more games.' }
  }),
  habit('poker-study', 'Poker study', '🃏', 'Study away from the table, not just at it.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['games', 'learning']
  }),
  habit('cube-practice', 'Speedcubing', '🧩', 'Timed solves and algorithm drills.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['games', 'practice']
  }),
  habit('read-poetry', 'Read something beautiful', '🌾', 'Poetry, prose, anything unhurried.', {
    difficulty: 'easy',
    points: 5,
    goal: 10,
    unit: 'minutes',
    tags: ['creative', 'reading']
  }),
  habit('creative-play', 'Do something purely for fun', '🎲', 'No productive justification.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'time',
    tags: ['creative', 'wellbeing']
  })
]);

const career = group(CAT, 'career', [
  habit('update-cv', 'Update your CV', '📄', 'While the wins are fresh.', {
    points: 15,
    goal: 1,
    unit: 'update',
    tags: ['career', 'admin']
  }),
  habit('network-message', 'Reach out to one contact', '🤝', 'A real message, not a broadcast.', {
    points: 15,
    goal: 1,
    unit: 'message',
    tags: ['career', 'social']
  }),
  habit('portfolio', 'Add to your portfolio', '🗂️', 'Document what you built.', {
    points: 15,
    goal: 1,
    unit: 'entry',
    tags: ['career', 'making']
  }),
  habit('ask-for-feedback', 'Ask for feedback', '🔍', 'Specific, not "how am I doing?".', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['career', 'learning']
  }),
  habit('log-wins', 'Log a win', '🏆', 'You will not remember it in six months.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'entry',
    tags: ['career', 'review']
  }),
  habit('leave-work-on-time', 'Finish at a set time', '🕔', 'Work expands to fill the day.', {
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['career', 'boundaries']
  }),
  habit('no-work-email-evening', 'No work email after hours', '📧', 'The evening is not the office.', {
    type: 'bad',
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['career', 'boundaries', 'avoid']
  })
]);

export const WORK: LibrarySection = {
  category: {
    id: CAT,
    name: 'Focus & Growth',
    icon: '⚡',
    description: 'Deep work, planning, learning and making things.',
    accent: 'from-amber-400 to-orange-600',
    subcategories: [
      sub('deep-work', 'Deep work', '🎯', 'Protecting attention from everything else.'),
      sub('planning', 'Planning & review', '📅', 'Deciding, capturing and reviewing.'),
      sub('learning', 'Learning', '📚', 'Reading, courses, language and practice.'),
      sub('creative', 'Creative', '🎨', 'Writing, music, art and shipping.'),
      sub('career', 'Career', '💼', 'Growth, visibility and boundaries.')
    ]
  },
  habits: [...deepWork, ...planning, ...learning, ...creative, ...career]
};
