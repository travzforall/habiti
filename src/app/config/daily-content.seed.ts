import { DailyContent } from '../models/daily-content.models';

/**
 * Bundled fallback content.
 *
 * The Baserow `daily_content` table is the real source. This exists so the
 * dashboard still shows something when that table is empty, unreachable, or
 * not yet created — an inspiration panel that renders blank is worse than no
 * panel at all.
 *
 * Everything here is public domain (KJV scripture, classical Stoics, quotes
 * whose authors died long enough ago to be safe) or written for Habiti. Do not
 * add copyrighted material to this file; put it in Baserow with a `source_url`
 * so its rights can be checked.
 */
export const DAILY_CONTENT_SEED: DailyContent[] = [
  // --- Scripture (KJV, public domain) ------------------------------------
  seed('s1', 'scripture', 'I can do all things through Christ which strengtheneth me.', {
    reference: 'Philippians 4:13',
    translation: 'KJV'
  }),
  seed('s2', 'scripture', 'Commit thy works unto the LORD, and thy thoughts shall be established.', {
    reference: 'Proverbs 16:3',
    translation: 'KJV'
  }),
  seed(
    's3',
    'scripture',
    'And let us not be weary in well doing: for in due season we shall reap, if we faint not.',
    { reference: 'Galatians 6:9', translation: 'KJV' }
  ),
  seed('s4', 'scripture', 'This is the day which the LORD hath made; we will rejoice and be glad in it.', {
    reference: 'Psalm 118:24',
    translation: 'KJV'
  }),
  seed(
    's5',
    'scripture',
    'Whatsoever thy hand findeth to do, do it with thy might.',
    { reference: 'Ecclesiastes 9:10', translation: 'KJV' }
  ),
  seed(
    's6',
    'scripture',
    'They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary.',
    { reference: 'Isaiah 40:31', translation: 'KJV' }
  ),
  seed('s7', 'scripture', 'The steps of a good man are ordered by the LORD.', {
    reference: 'Psalm 37:23',
    translation: 'KJV'
  }),

  // --- Motivational quotes (public domain / long-deceased authors) -------
  seed('q1', 'quotes', 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', {
    attribution: 'Will Durant',
    minTier: 'plus'
  }),
  seed('q2', 'quotes', 'It does not matter how slowly you go as long as you do not stop.', {
    attribution: 'Confucius',
    minTier: 'plus'
  }),
  seed('q3', 'quotes', 'Well begun is half done.', { attribution: 'Aristotle', minTier: 'plus' }),
  seed('q4', 'quotes', 'The secret of getting ahead is getting started.', {
    attribution: 'Mark Twain',
    minTier: 'plus'
  }),
  seed('q5', 'quotes', 'Little strokes fell great oaks.', {
    attribution: 'Benjamin Franklin',
    minTier: 'plus'
  }),
  seed('q6', 'quotes', 'Energy and persistence conquer all things.', {
    attribution: 'Benjamin Franklin',
    minTier: 'plus'
  }),

  // --- Stoic (public domain translations) --------------------------------
  seed(
    'st1',
    'stoic',
    'You have power over your mind — not outside events. Realize this, and you will find strength.',
    { attribution: 'Marcus Aurelius', reference: 'Meditations', minTier: 'plus' }
  ),
  seed('st2', 'stoic', 'Waste no more time arguing what a good man should be. Be one.', {
    attribution: 'Marcus Aurelius',
    reference: 'Meditations, 10.16',
    minTier: 'plus'
  }),
  seed('st3', 'stoic', 'We suffer more often in imagination than in reality.', {
    attribution: 'Seneca',
    reference: 'Letters',
    minTier: 'plus'
  }),
  seed('st4', 'stoic', 'It is not that we have a short time to live, but that we waste a lot of it.', {
    attribution: 'Seneca',
    reference: 'On the Shortness of Life',
    minTier: 'plus'
  }),
  seed('st5', 'stoic', 'First say to yourself what you would be; then do what you have to do.', {
    attribution: 'Epictetus',
    reference: 'Discourses',
    minTier: 'plus'
  }),
  seed('st6', 'stoic', 'No man is free who is not master of himself.', {
    attribution: 'Epictetus',
    minTier: 'plus'
  }),

  // --- Affirmations (written for Habiti) ---------------------------------
  seed('a1', 'affirmations', 'I show up for myself today, even when it is hard.', { minTier: 'plus' }),
  seed('a2', 'affirmations', 'I am not starting over. I am continuing.', { minTier: 'plus' }),
  seed('a3', 'affirmations', 'Small and consistent beats big and rare.', { minTier: 'plus' }),
  seed('a4', 'affirmations', 'A missed day is data, not failure.', { minTier: 'plus' }),
  seed('a5', 'affirmations', 'I keep the promises I make to myself.', { minTier: 'plus' }),
  seed('a6', 'affirmations', 'Today I choose the harder right over the easier wrong.', { minTier: 'plus' })
];

function seed(
  id: string,
  category: DailyContent['category'],
  body: string,
  extra: Partial<DailyContent> = {}
): DailyContent {
  return {
    id,
    category,
    body,
    sortIndex: Number(id.replace(/\D/g, '')) || 0,
    minTier: 'free',
    active: true,
    ...extra
  };
}
