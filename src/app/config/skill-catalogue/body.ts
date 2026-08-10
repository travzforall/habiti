import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/**
 * Body & Movement.
 *
 * Note that `stretch` and `foam-roll` appear in several skills here. That is
 * CORRECT and must not be de-duplicated: Strength and Mobility are different
 * proficiencies that draw on the same behaviour, and a day of stretching
 * legitimately advances both. Skills are lenses over the same evidence, not
 * owners of it.
 */

const CAT = 'body';

const skills = inCategory(CAT, [
  skill({
    id: 'strength',
    name: 'Strength',
    icon: '🏋️',
    description: 'Get measurably stronger at the movements everything else is built on.',
    habitIds: [
      'back-squat',
      'deadlift',
      'bench-press',
      'overhead-press',
      'warm-up',
      'protein-every-meal',
      'rest-day'
    ],
    starterTasks: [
      task(
        'form-check',
        'Film a set of each main lift',
        'Side-on, from the hips. Watching it back finds what a mirror cannot.',
        'high'
      ),
      task('set-baseline', 'Record your starting numbers', 'Squat, bench, deadlift, press.'),
      task('pick-programme', 'Choose a programme and stick to it', 'Any of them works; switching every fortnight does not.')
    ],
    starterProjects: [
      project(
        'twelve-week-block',
        'A twelve-week training block',
        'One programme, run to the end, with the numbers written down.',
        [
          'Write down starting weights for all four lifts',
          'Train three times a week for twelve weeks',
          'Deload in week six',
          'Retest all four lifts in week twelve'
        ]
      )
    ],
    campaignTemplateIds: ['iron-thirty'],
    sortIndex: 1,
    tiers: [
      tier(1, 'You have a routine and you turn up.', [req.days(7)]),
      tier(2, 'The main lifts feel like yours, and the bar moves the same way every time.', [
        req.days(30),
        req.tasks('form-check', 'set-baseline')
      ]),
      tier(3, 'A full training block finished, with numbers to show for it.', [
        req.days(90),
        req.volume(20000, 'kg', ['back-squat', 'deadlift', 'bench-press', 'overhead-press']),
        req.project('twelve-week-block')
      ]),
      tier(4, 'Consistent through a bad month. That is the part most people miss.', [
        req.days(180),
        req.streak(21),
        req.campaign('iron-thirty')
      ]),
      tier(5, 'Years, not months. Strength is a thing you have, not a thing you did.', [
        req.days(365),
        req.volume(100000, 'kg', ['back-squat', 'deadlift', 'bench-press', 'overhead-press'])
      ])
    ]
  }),

  skill({
    id: 'endurance',
    name: 'Endurance',
    icon: '🏃',
    description: 'Build an aerobic base that makes everything else easier.',
    habitIds: ['run', 'zone-2', 'walk-10k', 'stairs', 'foam-roll', 'sleep-7-hours'],
    starterTasks: [
      task('easy-pace', 'Find your conversational pace', 'If you cannot speak a full sentence, you are going too hard.', 'high'),
      task('route-set', 'Map three routes', 'Short, medium and long, so the decision is already made.')
    ],
    starterProjects: [
      project('first-distance', 'Run a distance you have not run before', 'Pick the number, build to it over eight weeks.', [
        'Choose a target distance and date',
        'Build weekly mileage by no more than 10%',
        'Run the distance'
      ])
    ],
    campaignTemplateIds: ['iron-thirty', 'no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Out of the door regularly, whatever the weather.', [req.days(7)]),
      tier(2, 'Easy days are genuinely easy, which is what makes hard days possible.', [
        req.days(30),
        req.tasks('easy-pace')
      ]),
      tier(3, 'A real aerobic base — distance no longer decides whether you go.', [
        req.days(90),
        req.volume(1500, 'minutes', ['run', 'zone-2']),
        req.project('first-distance')
      ]),
      tier(4, 'Training through a season, not a burst.', [req.days(180), req.streak(21), req.campaign('iron-thirty')]),
      tier(5, 'Endurance is your default state.', [req.days(365), req.volume(6000, 'minutes', ['run', 'zone-2'])])
    ]
  }),

  skill({
    id: 'mobility',
    name: 'Mobility',
    icon: '🤸',
    description: 'Move through a full range without paying for it the next day.',
    habitIds: ['stretch', 'hip-mobility', 'shoulder-mobility', 'post-workout-stretch', 'yoga', 'foam-roll'],
    starterTasks: [
      task('assess', 'Find your two worst restrictions', 'Usually hips and shoulders if you sit for work.', 'high'),
      task('daily-ten', 'Build a ten-minute daily sequence', 'Short and repeatable beats long and skipped.')
    ],
    starterProjects: [
      project('thirty-day-mobility', 'Thirty days of daily mobility', 'The one thing that reliably changes how you feel.', [
        'Pick the sequence',
        'Do it daily for thirty days',
        'Re-test the two restrictions'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Stretching is part of the day rather than an afterthought.', [req.days(7)]),
      tier(2, 'You know which restrictions are yours and work on those.', [req.days(30), req.tasks('assess')]),
      tier(3, 'Range has visibly changed, and it holds between sessions.', [
        req.days(90),
        req.volume(600, 'minutes'),
        req.project('thirty-day-mobility')
      ]),
      tier(4, 'Mobility survives busy weeks — the real test.', [req.days(180), req.streak(21)]),
      tier(5, 'Moving well is simply how you move.', [req.days(365), req.volume(3000, 'minutes')])
    ]
  }),

  skill({
    id: 'swimming',
    name: 'Swimming',
    icon: '🏊',
    description: 'Technique first — swimming punishes effort and rewards efficiency.',
    habitIds: ['swim', 'stretch', 'shoulder-mobility'],
    starterTasks: [
      task('breathing', 'Get bilateral breathing comfortable', 'Both sides, every third stroke.', 'high'),
      task('drill-set', 'Learn three technique drills', 'Catch-up, single-arm, kick on side.')
    ],
    starterProjects: [
      project('continuous-swim', 'Swim continuously for thirty minutes', 'Unbroken, at an easy pace.', [
        'Build to 400m unbroken',
        'Build to 1km unbroken',
        'Swim thirty minutes without stopping'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 4,
    tiers: [
      tier(1, 'In the water regularly.', [req.days(7)]),
      tier(2, 'Breathing no longer dictates how far you can go.', [req.days(30), req.tasks('breathing')]),
      tier(3, 'Distance is a choice, not a limit.', [req.days(60), req.project('continuous-swim')]),
      tier(4, 'Technique holds when you are tired.', [req.days(120), req.streak(14)]),
      tier(5, 'You swim like someone who has always swum.', [req.days(250), req.volume(3000, 'minutes')])
    ]
  }),

  skill({
    id: 'cycling',
    name: 'Cycling',
    icon: '🚴',
    description: 'Time in the saddle, built up sensibly.',
    habitIds: ['cycle', 'zone-2', 'stretch', 'walk-or-cycle'],
    starterTasks: [
      task('bike-fit', 'Get the bike set up properly', 'Saddle height first — most discomfort is fit, not fitness.', 'high'),
      task('maintenance', 'Learn to fix a puncture', 'The difference between an adventure and a walk home.')
    ],
    starterProjects: [
      project('long-ride', 'Complete a long ride', 'Pick a distance that currently sounds unreasonable.', [
        'Choose the route and date',
        'Build weekly distance gradually',
        'Ride it'
      ])
    ],
    campaignTemplateIds: ['iron-thirty'],
    sortIndex: 5,
    tiers: [
      tier(1, 'Riding regularly rather than occasionally.', [req.days(7)]),
      tier(2, 'The bike fits and you can fix it by the roadside.', [req.days(30), req.tasks('bike-fit', 'maintenance')]),
      tier(3, 'Long rides are within reach on any given weekend.', [req.days(90), req.project('long-ride')]),
      tier(4, 'Riding through the seasons, not just the good ones.', [req.days(180), req.streak(21)]),
      tier(5, 'Distance stops being the interesting question.', [req.days(365), req.volume(6000, 'minutes', ['cycle'])])
    ]
  }),

  skill({
    id: 'martial-arts',
    name: 'Martial Arts',
    icon: '🥋',
    description: 'Skill under pressure, learned slowly and with other people.',
    habitIds: ['martial-arts', 'stretch', 'hip-mobility', 'sleep-7-hours'],
    starterTasks: [
      task('find-gym', 'Find a gym and go twice', 'Once is a visit. Twice is a decision.', 'high'),
      task('basics', 'Drill the three fundamentals of your art', 'Whatever your coach names first.')
    ],
    starterProjects: [
      project('first-grading', 'Reach your first grading', 'The first belt is mostly about attendance.', [
        'Train twice a week consistently',
        'Learn the grading syllabus',
        'Grade'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 6,
    tiers: [
      tier(1, 'Training regularly and no longer feeling like a visitor.', [req.days(7)]),
      tier(2, 'The fundamentals are automatic enough to build on.', [req.days(30), req.tasks('basics')]),
      tier(3, 'Graded, and holding your own with training partners.', [req.days(90), req.project('first-grading')]),
      tier(4, 'Composure under pressure — the actual skill.', [req.days(180), req.streak(21)]),
      tier(5, 'Years in. You help the people who arrived last month.', [req.days(365)])
    ]
  }),

  skill({
    id: 'climbing',
    name: 'Climbing',
    icon: '🧗',
    description: 'Problem-solving with your whole body.',
    habitIds: ['climbing', 'pull-ups', 'shoulder-mobility', 'stretch'],
    starterTasks: [
      task('footwork', 'Spend one session on feet only', 'Almost everyone over-pulls and under-steps.', 'high'),
      task('grades', 'Find your working grade', 'The one where you fall off but can see the answer.')
    ],
    starterProjects: [
      project('project-route', 'Send a route above your grade', 'Pick one that is currently impossible.', [
        'Choose the route',
        'Work the individual moves',
        'Link it'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 7,
    tiers: [
      tier(1, 'Climbing regularly.', [req.days(7)]),
      tier(2, 'Footwork before strength — the change that unlocks everything.', [req.days(30), req.tasks('footwork')]),
      tier(3, 'A hard route worked and sent.', [req.days(90), req.project('project-route')]),
      tier(4, 'Reading routes before touching them.', [req.days(180), req.streak(14)]),
      tier(5, 'Grades are just information now.', [req.days(365)])
    ]
  }),

  skill({
    id: 'dance',
    name: 'Dance',
    icon: '💃',
    description: 'Rhythm, memory and moving without thinking about it.',
    habitIds: ['dance-practice', 'stretch', 'hip-mobility'],
    starterTasks: [
      task('one-style', 'Pick one style and stay with it', 'Breadth after depth, not instead of it.', 'high'),
      task('basic-step', 'Drill the basic step until it is boring', 'Then drill it more.')
    ],
    starterProjects: [
      project('social-dance', 'Dance socially for a whole evening', 'Not a class — an actual social.', [
        'Learn enough to lead or follow three songs',
        'Go to one social',
        'Stay for the whole evening'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 8,
    tiers: [
      tier(1, 'Practising regularly, however self-consciously.', [req.days(7)]),
      tier(2, 'The basic step is automatic and you can hear the count.', [req.days(30), req.tasks('basic-step')]),
      tier(3, 'You can dance socially without rehearsing it first.', [req.days(90), req.project('social-dance')]),
      tier(4, 'Musicality — dancing to the song, not the count.', [req.days(180), req.streak(14)]),
      tier(5, 'It looks easy, which took years.', [req.days(365)])
    ]
  })
]);

export const BODY: SkillSection = {
  category: {
    id: CAT,
    name: 'Body & Movement',
    icon: '🏋️',
    description: 'Strength, endurance and moving well.',
    accent: 'from-rose-400 to-red-600'
  },
  skills
};
