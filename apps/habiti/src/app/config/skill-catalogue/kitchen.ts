import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Kitchen — the domain where practice is eaten the same evening. */

const CAT = 'kitchen';

const skills = inCategory(CAT, [
  skill({
    id: 'home-cooking',
    name: 'Home Cooking',
    icon: '🍳',
    description: 'Cook well enough that eating out becomes a choice, not a rescue.',
    habitIds: ['cook-at-home', 'plan-meals', 'shopping-list', 'meal-prep', 'try-new-recipe', 'no-food-waste'],
    starterTasks: [
      task('sharpen-knife', 'Sharpen your knife', 'A blunt knife is slower and more dangerous.', 'high'),
      task('five-meals', 'Learn five meals by heart', 'No recipe, no phone. This is what "can cook" means.'),
      task('stock-pantry', 'Stock a basic pantry', 'So a decent meal is never a shopping trip away.')
    ],
    starterProjects: [
      project('cook-a-week', 'Cook every dinner for a week', 'Seven nights, no takeaway.', [
        'Plan seven meals',
        'Shop once',
        'Cook all seven'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Cooking rather than assembling.', [req.days(7)]),
      tier(2, 'Five meals you can make without looking anything up.', [req.days(30), req.tasks('five-meals')]),
      tier(3, 'A full week cooked from scratch, planned and shopped for.', [
        req.days(90),
        req.project('cook-a-week')
      ]),
      tier(4, 'Improvising from what is in the fridge.', [req.days(180), req.streak(21)]),
      tier(5, 'Cooking for other people without anxiety.', [req.days(365)])
    ]
  }),

  skill({
    id: 'baking',
    name: 'Baking',
    icon: '🥖',
    description: 'Chemistry you can eat. Weigh everything.',
    habitIds: ['baking-practice', 'try-new-recipe'],
    starterTasks: [
      task('buy-scales', 'Start weighing, stop measuring by volume', 'The single biggest jump in consistency.', 'high'),
      task('one-bread', 'Bake the same loaf three times', 'Same recipe, until it comes out the same.')
    ],
    starterProjects: [
      project('sourdough', 'Keep a starter alive and bake with it', 'Eight weeks, from flour and water to a loaf.', [
        'Start a culture',
        'Feed it for two weeks',
        'Bake a loaf',
        'Bake a better one'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Baking regularly rather than at Christmas.', [req.days(7)]),
      tier(2, 'Weighing everything, and results are repeatable.', [req.days(21), req.tasks('buy-scales', 'one-bread')]),
      tier(3, 'A living starter and a loaf worth giving away.', [req.days(60), req.project('sourdough')]),
      tier(4, 'Adjusting hydration and time by feel.', [req.days(150), req.streak(14)]),
      tier(5, 'People ask you to bring the bread.', [req.days(300)])
    ]
  }),

  skill({
    id: 'grilling',
    name: 'Grilling & Barbecue',
    icon: '🔥',
    description: 'Fire management, and cooking to temperature rather than to hope.',
    habitIds: ['grilling-practice', 'cook-at-home'],
    starterTasks: [
      task('thermometer', 'Cook to temperature, not to time', 'A thermometer ends the guessing permanently.', 'high'),
      task('two-zone', 'Set up a two-zone fire', 'Hot side, cool side. Almost every problem is solved by this.')
    ],
    starterProjects: [
      project('low-and-slow', 'Cook one thing low and slow', 'Eight hours, one piece of meat, a lot of patience.', [
        'Choose the cut',
        'Hold the temperature for the whole cook',
        'Rest it properly'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Cooking over fire regularly.', [req.days(7)]),
      tier(2, 'Temperature, not colour, decides when it is done.', [req.days(21), req.tasks('thermometer', 'two-zone')]),
      tier(3, 'A long cook held steady the whole way.', [req.days(60), req.project('low-and-slow')]),
      tier(4, 'Managing fire without thinking about it.', [req.days(120)]),
      tier(5, 'You cook for a crowd and everything lands together.', [req.days(250)])
    ]
  }),

  skill({
    id: 'coffee',
    name: 'Coffee',
    icon: '☕',
    description: 'One variable at a time, or you learn nothing.',
    habitIds: ['coffee-practice'],
    starterTasks: [
      task('weigh-dose', 'Weigh the coffee and the water', 'Ratios are the whole game.', 'high'),
      task('one-variable', 'Change one thing at a time for a week', 'Grind, then dose, then time.')
    ],
    starterProjects: [
      project('dial-in', 'Dial in one coffee properly', 'Same beans, until it tastes the same every morning.', [
        'Buy one bag of fresh beans',
        'Adjust grind until extraction is even',
        'Repeat the result three days running'
      ])
    ],
    campaignTemplateIds: ['first-seven'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Making coffee on purpose rather than on autopilot.', [req.days(7)]),
      tier(2, 'Weighing dose and water every time.', [req.days(21), req.tasks('weigh-dose')]),
      tier(3, 'One coffee dialled in and repeatable.', [req.days(45), req.project('dial-in')]),
      tier(4, 'Tasting the difference and knowing which variable caused it.', [req.days(120), req.tasks('one-variable')]),
      tier(5, 'Any beans, any method, consistently good.', [req.days(250)])
    ]
  })
]);

export const KITCHEN: SkillSection = {
  category: {
    id: CAT,
    name: 'Kitchen',
    icon: '🍳',
    description: 'Cooking, baking, fire and coffee.',
    accent: 'from-lime-400 to-green-600'
  },
  skills
};
