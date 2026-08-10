import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/**
 * Games.
 *
 * Included on purpose: they have the cleanest feedback loop of anything in the
 * catalogue — you find out immediately whether you were right — and studying
 * your own losses is the most transferable habit here.
 */

const CAT = 'games';

const skills = inCategory(CAT, [
  skill({
    id: 'chess',
    name: 'Chess',
    icon: '♟️',
    description: 'Reviewing your own losses teaches more than three more games.',
    habitIds: ['chess-practice', 'deliberate-practice', 'spaced-repetition'],
    starterTasks: [
      task('review-losses', 'Review every loss for a week', 'The single fastest improvement available.', 'high'),
      task('one-opening', 'Learn one opening properly', 'One, for both colours, rather than six badly.'),
      task('tactics-daily', 'Do tactics puzzles daily for two weeks', 'Most games below club level turn on tactics.')
    ],
    starterProjects: [
      project('rating-climb', 'Raise your rating by 200 points', 'Slowly, by fixing one recurring mistake at a time.', [
        'Record your starting rating',
        'Review every loss and log the mistake type',
        'Work on the most common one',
        'Play until the rating moves'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Playing and studying regularly.', [req.days(7)]),
      tier(2, 'Reviewing losses instead of immediately queuing again.', [req.days(30), req.tasks('review-losses')]),
      tier(3, 'One opening known properly and tactics sharp.', [
        req.days(90),
        req.tasks('one-opening', 'tactics-daily')
      ]),
      tier(4, 'A measurable climb, from fixing your own patterns.', [req.days(180), req.project('rating-climb')]),
      tier(5, 'You can explain why a move is good, not just that it is.', [req.days(365)])
    ]
  }),

  skill({
    id: 'poker',
    name: 'Poker',
    icon: '🃏',
    description: 'A game of decisions under uncertainty. The money is a scoreboard, not the point.',
    habitIds: ['poker-study', 'deliberate-practice', 'log-spending'],
    starterTasks: [
      task('bankroll-rules', 'Set bankroll rules and write them down', 'The rule that keeps this a skill rather than gambling.', 'high'),
      task('study-away', 'Study away from the table', 'Playing more is not studying.'),
      task('track-sessions', 'Track every session honestly', 'Including the ones you would rather forget.')
    ],
    starterProjects: [
      project('hundred-hands', 'Review a hundred of your own hands', 'Decisions, not outcomes.', [
        'Save a hundred hands you were unsure about',
        'Review them away from the table',
        'Note the recurring leak',
        'Play a session focused only on that'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 2,
    tiers: [
      tier(1, 'Studying regularly, not just playing.', [req.days(7)]),
      tier(2, 'Bankroll rules written down and followed.', [req.days(30), req.tasks('bankroll-rules', 'track-sessions')]),
      tier(3, 'A hundred hands reviewed and one leak identified.', [req.days(90), req.project('hundred-hands')]),
      tier(4, 'Judging decisions rather than results.', [req.days(180), req.tasks('study-away')]),
      tier(5, 'Emotionally flat over a losing week. That is the skill.', [req.days(365)])
    ]
  }),

  skill({
    id: 'speedcubing',
    name: 'Speedcubing',
    icon: '🧩',
    description: 'Pure, measurable, ruthlessly honest practice.',
    habitIds: ['cube-practice', 'deliberate-practice', 'spaced-repetition'],
    starterTasks: [
      task('learn-method', 'Learn a layer-by-layer method properly', 'Speed comes after the method is automatic.', 'high'),
      task('time-solves', 'Time every solve for a week', 'The number is the feedback.'),
      task('learn-f2l', 'Learn to solve the first two layers intuitively', 'The step where real times come from.')
    ],
    starterProjects: [
      project('sub-minute', 'Get under a minute', 'Or halve your current average, whichever is further.', [
        'Record your current average of twelve',
        'Drill the slowest stage',
        'Retest weekly until the target falls'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'first-seven'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Practising most days.', [req.days(7)]),
      tier(2, 'A method you can execute without thinking.', [req.days(30), req.tasks('learn-method', 'time-solves')]),
      tier(3, 'Under a minute, or half your starting average.', [req.days(90), req.project('sub-minute')]),
      tier(4, 'Intuitive first two layers, and look-ahead improving.', [req.days(180), req.tasks('learn-f2l')]),
      tier(5, 'Times are limited by your hands, not your knowledge.', [req.days(365)])
    ]
  })
]);

export const GAMES: SkillSection = {
  category: {
    id: CAT,
    name: 'Games',
    icon: '♟️',
    description: 'Fast feedback, and the discipline of reviewing your own mistakes.',
    accent: 'from-slate-400 to-slate-600'
  },
  skills
};
