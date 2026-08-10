import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Money — attention, in small regular doses, to the thing everyone avoids. */

const CAT = 'money';

const skills = inCategory(CAT, [
  skill({
    id: 'personal-finance',
    name: 'Personal Finance',
    icon: '💰',
    description: 'Know where it goes, then decide where it should go.',
    habitIds: ['log-spending', 'budget-review', 'no-impulse-buying', 'pay-bills-on-time', 'cancel-subscription'],
    starterTasks: [
      task('track-month', 'Track every penny for one month', 'People underestimate spending by about a third until they write it down.', 'high'),
      task('list-subscriptions', 'List every recurring payment', 'There will be at least one surprise.'),
      task('emergency-target', 'Decide your emergency fund target', 'One number, written down.')
    ],
    starterProjects: [
      project('build-budget', 'Build a budget you will actually keep', 'Based on what you really spend, not what you wish you spent.', [
        'Track a full month',
        'Categorise it honestly',
        'Set limits you believe',
        'Review it after one month and adjust'
      ])
    ],
    campaignTemplateIds: ['first-seven', 'no-zero-days-14'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Looking at your money rather than avoiding it.', [req.days(7)]),
      tier(2, 'A full month tracked, and no more surprises.', [req.days(30), req.tasks('track-month', 'list-subscriptions')]),
      tier(3, 'A budget that survives contact with a real month.', [req.days(90), req.project('build-budget')]),
      tier(4, 'Spending is a decision, not a discovery.', [req.days(180), req.streak(21)]),
      tier(5, 'Money is boring, which is the goal.', [req.days(365)])
    ]
  }),

  skill({
    id: 'investing',
    name: 'Investing',
    icon: '📈',
    description: 'Mostly patience and low fees. The interesting parts are usually the expensive ones.',
    habitIds: ['learn-investing', 'save-transfer', 'budget-review'],
    starterTasks: [
      task('learn-fees', 'Find out what you are paying in fees', 'It is usually more than expected and it compounds.', 'high'),
      task('automate', 'Automate one regular contribution', 'Saving what is left over rarely works.'),
      task('write-plan', 'Write down your plan in one paragraph', 'So you can read it when markets fall.')
    ],
    starterProjects: [
      project('first-year', 'Invest consistently for a year', 'Same amount, same day, regardless of the news.', [
        'Decide the amount and the date',
        'Automate it',
        'Do not check it weekly',
        'Review once at twelve months'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Learning about it regularly.', [req.days(7)]),
      tier(2, 'You know your fees and have a written plan.', [req.days(30), req.tasks('learn-fees', 'write-plan')]),
      tier(3, 'Contributions automated and running.', [req.days(90), req.tasks('automate')]),
      tier(4, 'A full year of consistency, including a bad month.', [req.days(180), req.project('first-year')]),
      tier(5, 'You do nothing during a crash. That is the whole skill.', [req.days(365)])
    ]
  }),

  skill({
    id: 'side-income',
    name: 'Side Income',
    icon: '🚀',
    description: 'Something small that earns, built in the hours you have.',
    habitIds: ['side-project', 'ship-something', 'network-message', 'no-zero-day'],
    starterTasks: [
      task('one-offer', 'Write down one thing you could sell', 'A service counts. It usually beats a product for a first attempt.', 'high'),
      task('first-ask', 'Tell ten people about it', 'The uncomfortable step that decides whether anything happens.')
    ],
    starterProjects: [
      project('first-pound', 'Earn your first payment', 'Any amount. The first is qualitatively different from none.', [
        'Define the offer precisely',
        'Tell people it exists',
        'Deliver it once',
        'Ask what they would pay for next'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w', 'no-zero-days-14'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Working on it regularly.', [req.days(7)]),
      tier(2, 'A clear offer, told to real people.', [req.days(30), req.tasks('one-offer', 'first-ask')]),
      tier(3, 'Money received from someone who is not a friend.', [req.days(90), req.project('first-pound')]),
      tier(4, 'Repeat customers, or a second sale without a new pitch.', [req.days(180), req.streak(21)]),
      tier(5, 'It runs without heroics, and the income is dependable.', [req.days(365)])
    ]
  }),

  skill({
    id: 'money-admin',
    name: 'Tax & Admin',
    icon: '🧾',
    description: 'Dull, avoidable for a while, and expensive when it is not done.',
    habitIds: ['pay-bills-on-time', 'inbox-paper', 'log-spending', 'budget-review'],
    starterTasks: [
      task('one-folder', 'Put everything financial in one place', 'Paper and digital. One place, not four.', 'high'),
      task('deadline-list', 'Write down every deadline for the year', 'Then put them in the calendar with a reminder.'),
      task('records-system', 'Set up a records system you will keep', 'Simple enough that you use it in a busy week.')
    ],
    starterProjects: [
      project('year-sorted', 'Get a full year in order', 'Records, deadlines, receipts, filed and findable.', [
        'Gather everything into one place',
        'Sort by year and category',
        'File the outstanding returns',
        'Set reminders for next year'
      ])
    ],
    campaignTemplateIds: ['first-seven'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Opening the post rather than stacking it.', [req.days(7)]),
      tier(2, 'One folder, one calendar, all deadlines known.', [req.days(30), req.tasks('one-folder', 'deadline-list')]),
      tier(3, 'A full year sorted and findable.', [req.days(90), req.project('year-sorted')]),
      tier(4, 'Nothing is ever late.', [req.days(180), req.tasks('records-system')]),
      tier(5, 'Admin takes an hour a month and causes no dread.', [req.days(365)])
    ]
  })
]);

export const MONEY: SkillSection = {
  category: {
    id: CAT,
    name: 'Money',
    icon: '💰',
    description: 'Spending, saving, earning and the paperwork.',
    accent: 'from-emerald-400 to-teal-600'
  },
  skills
};
