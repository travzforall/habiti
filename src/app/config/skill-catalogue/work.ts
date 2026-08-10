import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Work & Communication — how you spend the hours you are paid for. */

const CAT = 'work';

const skills = inCategory(CAT, [
  skill({
    id: 'deep-work',
    name: 'Deep Work',
    icon: '🎯',
    description: 'The capacity to concentrate hard on one thing, on demand.',
    habitIds: ['deep-work-block', 'pomodoro', 'single-tasking', 'no-social-during-work', 'phone-in-other-room', 'top-three'],
    starterTasks: [
      task('phone-away', 'Put the phone in another room for one block', 'Face-down on the desk is not the same.', 'high'),
      task('pick-tomorrow', 'Choose tomorrow\'s block tonight', 'Deciding cold is how the block never happens.')
    ],
    starterProjects: [
      project('four-weeks-focus', 'Four weeks of daily deep work', 'One protected block a day, defended.', [
        'Choose the time of day and protect it in the calendar',
        'Run a block daily for four weeks',
        'Note what got finished that otherwise would not have'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w'],
    sortIndex: 1,
    tiers: [
      tier(1, 'A block happens most days.', [req.days(7)]),
      tier(2, 'The phone is elsewhere and the block is decided in advance.', [
        req.days(30),
        req.tasks('phone-away', 'pick-tomorrow')
      ]),
      tier(3, 'Four weeks of protected focus, with output to show for it.', [
        req.days(90),
        req.volume(4000, 'minutes', ['deep-work-block']),
        req.project('four-weeks-focus')
      ]),
      tier(4, 'Concentration survives a busy calendar.', [
        req.days(180),
        req.streak(21),
        req.campaign('deep-work-4w')
      ]),
      tier(5, 'Deep work is the default mode, not the exception.', [
        req.days(365),
        req.volume(15000, 'minutes', ['deep-work-block'])
      ])
    ]
  }),

  skill({
    id: 'programming',
    name: 'Programming',
    icon: '💻',
    description: 'Built by shipping things, not by watching tutorials.',
    habitIds: ['deliberate-practice', 'course-lesson', 'side-project', 'ship-something', 'teach-someone'],
    starterTasks: [
      task('finish-tutorial', 'Finish one tutorial and then change it', 'Changing it is where the learning is.', 'high'),
      task('read-code', 'Read someone else\'s codebase for an hour', 'An underrated way to get better fast.'),
      task('version-control', 'Put everything in version control', 'Including the throwaway experiments.')
    ],
    starterProjects: [
      project('ship-one', 'Ship something people can use', 'Small and finished beats ambitious and abandoned.', [
        'Choose something small and genuinely useful',
        'Build the smallest version that works',
        'Put it somewhere public',
        'Fix the first thing someone complains about'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w', 'no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Writing code regularly.', [req.days(7)]),
      tier(2, 'Beyond tutorials — changing things and breaking them.', [req.days(30), req.tasks('finish-tutorial')]),
      tier(3, 'Something shipped that other people can use.', [
        req.days(90),
        req.volume(2700, 'minutes', ['deliberate-practice', 'side-project']),
        req.project('ship-one')
      ]),
      tier(4, 'Reading unfamiliar code without fear.', [req.days(180), req.tasks('read-code'), req.streak(21)]),
      tier(5, 'You choose the approach, not just the syntax.', [req.days(365)])
    ]
  }),

  skill({
    id: 'writing',
    name: 'Writing',
    icon: '✍️',
    description: 'Think clearly, then write it down. Usually in that order, sometimes not.',
    habitIds: ['write-500', 'journal', 'read-30', 'ship-something'],
    starterTasks: [
      task('draft-badly', 'Write one deliberately bad first draft', 'Editing while drafting is why people stall.', 'high'),
      task('cut-ten', 'Cut ten percent from something you wrote', 'It is always better afterwards.')
    ],
    starterProjects: [
      project('publish-three', 'Publish three pieces', 'Anywhere public. Finished, not perfect.', [
        'Draft three pieces',
        'Edit each one down',
        'Publish all three'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'deep-work-4w'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Writing most days.', [req.days(7)]),
      tier(2, 'Drafting freely and editing separately.', [req.days(30), req.tasks('draft-badly')]),
      tier(3, 'Three pieces finished and published.', [
        req.days(90),
        req.volume(45000, 'words', ['write-500']),
        req.project('publish-three')
      ]),
      tier(4, 'Editing ruthlessly — the part that separates writers.', [
        req.days(180),
        req.tasks('cut-ten'),
        req.streak(21)
      ]),
      tier(5, 'A voice that is recognisably yours.', [req.days(365), req.volume(180000, 'words', ['write-500'])])
    ]
  }),

  skill({
    id: 'public-speaking',
    name: 'Public Speaking',
    icon: '🎙️',
    description: 'The fear never fully goes. The competence makes it bearable.',
    habitIds: ['public-speaking-practice', 'teach-someone', 'ask-for-feedback'],
    starterTasks: [
      task('record-once', 'Record yourself once and watch it', 'Grim, and the fastest correction available.', 'high'),
      task('no-script', 'Speak from notes, not a script', 'Memorised text collapses the moment you lose your place.')
    ],
    starterProjects: [
      project('give-a-talk', 'Give one talk to a real audience', 'A meetup, a team, a club. Any size.', [
        'Choose a topic you already know well',
        'Structure it in three parts',
        'Rehearse standing up, out loud, timed',
        'Give it'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Practising out loud rather than in your head.', [req.days(7)]),
      tier(2, 'You have watched yourself back and survived it.', [req.days(30), req.tasks('record-once')]),
      tier(3, 'One talk given to a real audience.', [req.days(60), req.project('give-a-talk')]),
      tier(4, 'Speaking from notes, adapting to the room.', [req.days(120), req.tasks('no-script')]),
      tier(5, 'You would say yes to speaking without a knot in your stomach.', [req.days(250)])
    ]
  }),

  skill({
    id: 'design',
    name: 'Design',
    icon: '🎨',
    description: 'Type, space and hierarchy — mostly learned by copying and noticing.',
    habitIds: ['design-practice', 'sketch', 'ask-for-feedback'],
    starterTasks: [
      task('copy-good', 'Recreate a design you admire', 'Pixel by pixel. You learn what the decisions were.', 'high'),
      task('type-only', 'Design something with type alone', 'No colour, no images. It exposes everything.')
    ],
    starterProjects: [
      project('redesign-one', 'Redesign something real', 'A page, a poster, an interface you use and dislike.', [
        'Choose the thing and say what is wrong with it',
        'Produce three different directions',
        'Finish the best one properly'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w'],
    sortIndex: 5,
    tiers: [
      tier(1, 'Designing regularly.', [req.days(7)]),
      tier(2, 'Copying good work deliberately to learn from it.', [req.days(30), req.tasks('copy-good')]),
      tier(3, 'A finished redesign you can defend.', [req.days(90), req.project('redesign-one')]),
      tier(4, 'Hierarchy and spacing are deliberate, not accidental.', [req.days(180), req.tasks('type-only')]),
      tier(5, 'You can explain why something works, not just that it does.', [req.days(365)])
    ]
  }),

  skill({
    id: 'data-analysis',
    name: 'Data Analysis',
    icon: '📊',
    description: 'Asking a question the data can actually answer.',
    habitIds: ['data-practice', 'course-lesson', 'deliberate-practice'],
    starterTasks: [
      task('one-dataset', 'Take one dataset and ask three questions of it', 'Questions first, charts second.', 'high'),
      task('clean-data', 'Clean a messy dataset properly', 'Most of the job, and the part courses skip.')
    ],
    starterProjects: [
      project('analysis-writeup', 'Answer a real question with data', 'End to end, written up for someone else.', [
        'Choose a question you actually care about',
        'Find and clean the data',
        'Analyse it',
        'Write up what you found and what you are unsure of'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w'],
    sortIndex: 6,
    tiers: [
      tier(1, 'Working with data regularly.', [req.days(7)]),
      tier(2, 'Cleaning data without dreading it.', [req.days(30), req.tasks('clean-data')]),
      tier(3, 'One analysis done end to end and written up.', [req.days(90), req.project('analysis-writeup')]),
      tier(4, 'Choosing the right question before the right chart.', [req.days(180), req.tasks('one-dataset')]),
      tier(5, 'Honest about uncertainty — the mark of someone worth trusting.', [req.days(365)])
    ]
  }),

  skill({
    id: 'negotiation',
    name: 'Negotiation',
    icon: '🤝',
    description: 'Preparation and listening, far more than nerve.',
    habitIds: ['negotiation-practice', 'listen-without-fixing', 'ask-for-feedback', 'say-no'],
    starterTasks: [
      task('know-walkaway', 'Write down your walk-away point before negotiating', 'The single most useful preparation there is.', 'high'),
      task('ask-once', 'Ask for something you would normally not ask for', 'Small stakes. The asking is the practice.')
    ],
    starterProjects: [
      project('one-real-negotiation', 'Prepare and run one real negotiation', 'A salary, a contract, a price.', [
        'Research what is normal',
        'Write down your target and walk-away',
        'Have the conversation',
        'Debrief honestly afterwards'
      ])
    ],
    campaignTemplateIds: ['first-seven'],
    sortIndex: 7,
    tiers: [
      tier(1, 'Practising or preparing regularly.', [req.days(7)]),
      tier(2, 'You know your walk-away before you open your mouth.', [req.days(21), req.tasks('know-walkaway')]),
      tier(3, 'One real negotiation prepared and run.', [req.days(60), req.project('one-real-negotiation')]),
      tier(4, 'Listening more than talking, on purpose.', [req.days(120), req.tasks('ask-once')]),
      tier(5, 'Comfortable with silence and with being told no.', [req.days(250)])
    ]
  }),

  skill({
    id: 'project-management',
    name: 'Project Management',
    icon: '🗂️',
    description: 'Getting work finished with other people involved.',
    habitIds: ['weekly-review', 'top-three', 'time-block', 'capture-everything', 'say-no'],
    starterTasks: [
      task('one-list', 'Get everything into one list', 'Two systems means neither is trusted.', 'high'),
      task('weekly-habit', 'Run a weekly review four weeks running', 'The habit that keeps every system from rotting.')
    ],
    starterProjects: [
      project('run-one', 'Run one project to completion', 'Scoped, planned, delivered, reviewed.', [
        'Write down what done looks like',
        'Break it into tasks with owners',
        'Run it to completion',
        'Hold a short retrospective'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w', 'no-zero-days-14'],
    sortIndex: 8,
    tiers: [
      tier(1, 'Capturing and planning regularly.', [req.days(7)]),
      tier(2, 'One trusted list, reviewed weekly.', [req.days(30), req.tasks('one-list', 'weekly-habit')]),
      tier(3, 'A project delivered and reviewed.', [req.days(90), req.project('run-one')]),
      tier(4, 'Scope and expectations managed before they become problems.', [req.days(180), req.streak(21)]),
      tier(5, 'People want you running the thing.', [req.days(365)])
    ]
  })
]);

export const WORK: SkillSection = {
  category: {
    id: CAT,
    name: 'Work & Communication',
    icon: '⚡',
    description: 'Focus, craft and working with other people.',
    accent: 'from-amber-400 to-orange-600'
  },
  skills
};
