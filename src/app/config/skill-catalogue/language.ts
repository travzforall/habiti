import { SkillDefinition, SkillSection, inCategory, project, req, skill, task, tier } from './types';

/**
 * Languages.
 *
 * Every language follows the same ladder, so it is built once and stamped per
 * language rather than copied five times. The differences that matter to a
 * learner — script, tones, cases — go in the description, not the structure.
 */

const CAT = 'language';

function language(
  id: string,
  name: string,
  icon: string,
  description: string,
  sortIndex: number
): SkillDefinition {
  return skill({
    id,
    name,
    icon,
    description,
    habitIds: ['practise-language', 'language-speaking', 'spaced-repetition', 'watch-lecture', 'take-notes'],
    starterTasks: [
      task('daily-slot', 'Fix a fifteen-minute daily slot', 'Fifteen minutes daily beats two hours on Sunday.', 'high'),
      task('first-hundred', 'Learn the hundred most common words', 'They cover an absurd share of ordinary speech.'),
      task('find-partner', 'Find someone to speak with', 'Speaking is the part everyone postpones and the part that works.')
    ],
    starterProjects: [
      project('first-conversation', 'Hold a five-minute conversation', 'Unscripted, with a real person.', [
        'Learn enough to introduce yourself',
        'Book a conversation session',
        'Talk for five minutes without switching to English'
      ]),
      project('consume-native', 'Finish something made for native speakers', 'A film, a book, a podcast series.', [
        'Choose something you would enjoy in your own language',
        'Get through it with subtitles or a dictionary',
        'Go through it again with less help'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'deep-work-4w'],
    sortIndex,
    tiers: [
      tier(1, 'Studying daily, however briefly.', [req.days(7)]),
      tier(2, 'The core vocabulary is in, and a daily slot exists.', [
        req.days(30),
        req.tasks('daily-slot', 'first-hundred')
      ]),
      tier(3, 'A real conversation held, badly, with a real person.', [
        req.days(90),
        req.volume(1350, 'minutes', ['practise-language']),
        req.project('first-conversation')
      ]),
      tier(4, 'Native material is enjoyable rather than an exercise.', [
        req.days(180),
        req.streak(21),
        req.project('consume-native')
      ]),
      tier(5, 'You think in it occasionally, which is the real threshold.', [
        req.days(365),
        req.volume(5000, 'minutes', ['practise-language'])
      ])
    ]
  });
}

const skills = inCategory(CAT, [
  language('spanish', 'Spanish', '🇪🇸', 'Regular, phonetic, and spoken almost everywhere.', 1),
  language('french', 'French', '🇫🇷', 'Listening is the hard part; the written form flatters you.', 2),
  language('german', 'German', '🇩🇪', 'Cases early, then it becomes remarkably logical.', 3),
  language('japanese', 'Japanese', '🇯🇵', 'Three scripts and a grammar unlike anything European.', 4),
  language('sign-language', 'Sign Language', '🤟', 'Visual grammar, facial expression, and a community to learn it in.', 5)
]);

export const LANGUAGE: SkillSection = {
  category: {
    id: CAT,
    name: 'Language',
    icon: '🗣️',
    description: 'Learning to speak with people you currently cannot.',
    accent: 'from-sky-400 to-blue-600'
  },
  skills
};
