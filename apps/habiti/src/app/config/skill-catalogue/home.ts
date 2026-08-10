import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Home & Life — competence at the place you actually live. */

const CAT = 'home';

const skills = inCategory(CAT, [
  skill({
    id: 'gardening',
    name: 'Gardening',
    icon: '🌱',
    description: 'Slow feedback, seasonal, and unusually good for you.',
    habitIds: ['gardening', 'water-plants', 'get-outside'],
    starterTasks: [
      task('know-your-soil', 'Find out what your soil and light actually are', 'Half of all failures are the wrong plant in the wrong place.', 'high'),
      task('start-small', 'Plant three things, not thirty', 'Keeping three alive teaches more than losing thirty.')
    ],
    starterProjects: [
      project('grow-something-edible', 'Grow something you can eat', 'From seed to plate, once.', [
        'Choose something easy for your climate',
        'Sow it at the right time',
        'Keep it alive',
        'Eat it'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Out there regularly rather than occasionally.', [req.days(7)]),
      tier(2, 'You know your soil, light and frost dates.', [req.days(30), req.tasks('know-your-soil')]),
      tier(3, 'Something grown and eaten.', [req.days(90), req.project('grow-something-edible')]),
      tier(4, 'Planning a season ahead instead of reacting.', [req.days(180), req.tasks('start-small')]),
      tier(5, 'The garden mostly runs itself, and you know why.', [req.days(365)])
    ]
  }),

  skill({
    id: 'home-diy',
    name: 'Home DIY',
    icon: '🔧',
    description: 'Fix it yourself, or at least know when not to.',
    habitIds: ['home-maintenance', 'tidy-15', 'woodworking-practice'],
    starterTasks: [
      task('basic-tools', 'Assemble a basic tool kit', 'A dozen tools covers most household jobs.', 'high'),
      task('find-studs', 'Learn to find studs and check for pipes and cables', 'Before drilling. Always before drilling.'),
      task('know-limits', 'Know which jobs need a professional', 'Gas and mains electricity are not DIY.')
    ],
    starterProjects: [
      project('fix-list', 'Clear the snag list', 'Every small broken thing in the house, in one go.', [
        'Walk every room and write down what is wrong',
        'Group by tool and trip to the shop',
        'Fix them',
        'Note which need a professional'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Doing small jobs instead of postponing them.', [req.days(7)]),
      tier(2, 'A tool kit and the sense to check before drilling.', [req.days(21), req.tasks('basic-tools', 'find-studs')]),
      tier(3, 'The snag list cleared.', [req.days(60), req.project('fix-list')]),
      tier(4, 'Bigger jobs attempted, and finished properly.', [req.days(120), req.tasks('know-limits')]),
      tier(5, 'Most things in the house, you can fix.', [req.days(250)])
    ]
  }),

  skill({
    id: 'car-care',
    name: 'Car Maintenance',
    icon: '🚗',
    description: 'Checks that cost minutes and save breakdowns.',
    habitIds: ['car-maintenance'],
    starterTasks: [
      task('monthly-checks', 'Learn the five monthly checks', 'Oil, coolant, tyres, lights, screenwash.', 'high'),
      task('change-tyre', 'Change a wheel once, in daylight, at home', 'Not for the first time on a motorway verge.')
    ],
    starterProjects: [
      project('service-yourself', 'Do one service yourself', 'Oil, filters, plugs — with the manual open.', [
        'Get the manual and the right parts',
        'Do the service',
        'Dispose of the oil properly',
        'Record what you did and the mileage'
      ])
    ],
    campaignTemplateIds: ['first-seven'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Checking the car rather than waiting for a warning light.', [req.days(7)]),
      tier(2, 'The monthly checks are automatic.', [req.days(30), req.tasks('monthly-checks')]),
      tier(3, 'You can change a wheel calmly.', [req.days(60), req.tasks('change-tyre')]),
      tier(4, 'A service done yourself, properly recorded.', [req.days(120), req.project('service-yourself')]),
      tier(5, 'You diagnose the noise before the garage does.', [req.days(250)])
    ]
  }),

  skill({
    id: 'organising',
    name: 'Organising',
    icon: '🧹',
    description: 'Less stuff, and a place for what is left.',
    habitIds: ['tidy-15', 'declutter-one-thing', 'dishes-before-bed', 'laundry', 'prep-tomorrow', 'make-bed'],
    starterTasks: [
      task('one-drawer', 'Empty and reset one drawer', 'Start absurdly small so it actually starts.', 'high'),
      task('donate-box', 'Fill one box to donate', 'Then take it. The taking is the hard part.')
    ],
    starterProjects: [
      project('room-by-room', 'Reset the whole house, one room at a time', 'Nothing goes back without a place.', [
        'List the rooms in order of pain',
        'Do one room a week',
        'Give everything a home',
        'Do a maintenance pass after a month'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Tidying a little most days.', [req.days(7)]),
      tier(2, 'One box gone, one drawer that stays sorted.', [req.days(30), req.tasks('one-drawer', 'donate-box')]),
      tier(3, 'Every room reset, everything with a home.', [req.days(90), req.project('room-by-room')]),
      tier(4, 'It stays that way through a busy month.', [req.days(180), req.streak(21)]),
      tier(5, 'Tidy is the resting state, not an event.', [req.days(365)])
    ]
  }),

  skill({
    id: 'hosting',
    name: 'Hosting',
    icon: '🍽️',
    description: 'Feeding people and making them comfortable — an underrated skill.',
    habitIds: ['hosting-practice', 'cook-at-home', 'meet-in-person', 'quality-time'],
    starterTasks: [
      task('one-menu', 'Learn one menu you can cook without stress', 'The same one, every time, until it is easy.', 'high'),
      task('prep-ahead', 'Cook something that is finished before guests arrive', 'Hosting is not performing in the kitchen.')
    ],
    starterProjects: [
      project('dinner-for-six', 'Host dinner for six', 'Cooked by you, and you sit down with them.', [
        'Plan a menu you can mostly make ahead',
        'Shop and prep the day before',
        'Cook it',
        'Actually sit down and eat with everyone'
      ])
    ],
    campaignTemplateIds: ['first-seven'],
    sortIndex: 5,
    tiers: [
      tier(1, 'Having people over rather than meaning to.', [req.days(7)]),
      tier(2, 'One menu you can cook without panic.', [req.days(30), req.tasks('one-menu')]),
      tier(3, 'Dinner for six, and you enjoyed it too.', [req.days(60), req.project('dinner-for-six')]),
      tier(4, 'Most of it done ahead, so you are in the room.', [req.days(120), req.tasks('prep-ahead')]),
      tier(5, 'People invite themselves, which is the compliment.', [req.days(250)])
    ]
  })
]);

export const HOME: SkillSection = {
  category: {
    id: CAT,
    name: 'Home & Life',
    icon: '🏠',
    description: 'The place you live and the people you have round.',
    accent: 'from-teal-400 to-cyan-600'
  },
  skills
};
