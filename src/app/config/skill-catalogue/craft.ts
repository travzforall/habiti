import { SkillSection, inCategory, project, req, skill, task, tier } from './types';

/** Craft & Making — skills where the output is a thing you can point at. */

const CAT = 'craft';

const skills = inCategory(CAT, [
  skill({
    id: 'guitar',
    name: 'Guitar',
    icon: '🎸',
    description: 'Slow, accurate practice beats fast, sloppy practice every time.',
    habitIds: ['practise-instrument', 'deliberate-practice', 'make-music'],
    starterTasks: [
      task('tune-by-ear', 'Learn to tune by ear', 'Then check with a tuner. Both skills matter.', 'high'),
      task('four-chords', 'Learn four chords and change between them cleanly', 'Clean changes first, speed later.'),
      task('metronome', 'Practise with a metronome for one week', 'It will be humbling and it will work.')
    ],
    starterProjects: [
      project('first-song', 'Learn one song end to end', 'All the way through, from memory, at tempo.', [
        'Choose a song within reach',
        'Learn it in sections',
        'Play it start to finish without stopping'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'deep-work-4w'],
    sortIndex: 1,
    tiers: [
      tier(1, 'Picking it up most days, even for ten minutes.', [req.days(7)]),
      tier(2, 'Chord changes are clean and your fingertips have stopped complaining.', [
        req.days(30),
        req.tasks('four-chords')
      ]),
      tier(3, 'A whole song, from memory, at tempo.', [
        req.days(90),
        req.volume(1200, 'minutes', ['practise-instrument']),
        req.project('first-song')
      ]),
      tier(4, 'Playing in front of someone without apologising first.', [req.days(180), req.streak(21)]),
      tier(5, 'You can pick up an unfamiliar song and work it out yourself.', [
        req.days(365),
        req.volume(6000, 'minutes', ['practise-instrument'])
      ])
    ]
  }),

  skill({
    id: 'piano',
    name: 'Piano',
    icon: '🎹',
    description: 'Two hands doing different things — the hardest part, and the whole point.',
    habitIds: ['practise-instrument', 'deliberate-practice', 'make-music'],
    starterTasks: [
      task('hands-separate', 'Practise hands separately before together', 'Almost every plateau is impatience with this.', 'high'),
      task('sight-read', 'Sight-read something new each week', 'Badly. That is what sight-reading is.')
    ],
    starterProjects: [
      project('one-piece', 'Learn one piece properly', 'Memorised, at tempo, without stumbles.', [
        'Choose a piece slightly beyond you',
        'Learn hands separately',
        'Bring it to tempo',
        'Play it from memory'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14', 'deep-work-4w'],
    sortIndex: 2,
    tiers: [
      tier(1, 'At the keys most days.', [req.days(7)]),
      tier(2, 'Hands together on simple pieces without falling apart.', [req.days(30), req.tasks('hands-separate')]),
      tier(3, 'A full piece performed from memory.', [
        req.days(90),
        req.volume(1200, 'minutes', ['practise-instrument']),
        req.project('one-piece')
      ]),
      tier(4, 'Reading well enough to learn without a tutorial.', [req.days(180), req.tasks('sight-read')]),
      tier(5, 'The instrument stops being in the way of the music.', [
        req.days(365),
        req.volume(6000, 'minutes', ['practise-instrument'])
      ])
    ]
  }),

  skill({
    id: 'singing',
    name: 'Singing',
    icon: '🎤',
    description: 'Breath, pitch and the nerve to be heard.',
    habitIds: ['singing-practice', 'deliberate-practice'],
    starterTasks: [
      task('warm-up-voice', 'Learn a five-minute vocal warm-up', 'Never sing hard cold.', 'high'),
      task('record-yourself', 'Record yourself once', 'It is always worse than it feels and better than you fear.')
    ],
    starterProjects: [
      project('one-song-sung', 'Sing one song properly', 'In tune, in your range, all the way through.', [
        'Find a song in your actual range',
        'Learn the melody exactly',
        'Record a take you would let someone hear'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 3,
    tiers: [
      tier(1, 'Singing regularly rather than only in the car.', [req.days(7)]),
      tier(2, 'Warming up first, and staying in your range.', [req.days(30), req.tasks('warm-up-voice')]),
      tier(3, 'A song you would let someone else hear.', [req.days(90), req.project('one-song-sung')]),
      tier(4, 'Pitch holds under nerves.', [req.days(180), req.streak(21)]),
      tier(5, 'Your voice does what you ask of it.', [req.days(365)])
    ]
  }),

  skill({
    id: 'drawing',
    name: 'Drawing',
    icon: '✏️',
    description: 'Learning to see accurately. The hand catches up later.',
    habitIds: ['sketch', 'deliberate-practice', 'creative-play'],
    starterTasks: [
      task('daily-sketch', 'Fill one sketchbook page a day for a week', 'Quantity first — quality is downstream of it.', 'high'),
      task('draw-from-life', 'Draw from life, not photos, for a week', 'Photos have already flattened the hard part.')
    ],
    starterProjects: [
      project('sketchbook', 'Fill a sketchbook', 'Cover to cover, bad pages included.', [
        'Buy a small sketchbook',
        'Draw daily without tearing pages out',
        'Fill it'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 4,
    tiers: [
      tier(1, 'Drawing regularly, badly, without minding.', [req.days(7)]),
      tier(2, 'Observing rather than drawing from memory of symbols.', [req.days(30), req.tasks('draw-from-life')]),
      tier(3, 'A full sketchbook and visible improvement across it.', [
        req.days(90),
        req.volume(900, 'minutes', ['sketch']),
        req.project('sketchbook')
      ]),
      tier(4, 'Proportion and perspective are mostly right first time.', [req.days(180), req.streak(21)]),
      tier(5, 'You draw what you see, not what you know.', [req.days(365), req.volume(4000, 'minutes', ['sketch'])])
    ]
  }),

  skill({
    id: 'painting',
    name: 'Painting',
    icon: '🎨',
    description: 'Colour, value and knowing when to stop.',
    habitIds: ['painting-practice', 'sketch', 'creative-play'],
    starterTasks: [
      task('limited-palette', 'Paint with three colours and white', 'Limits teach colour faster than a full set.', 'high'),
      task('value-study', 'Do a greyscale study first', 'Most colour problems are value problems.')
    ],
    starterProjects: [
      project('finished-piece', 'Finish one painting', 'Framed or not, but finished.', [
        'Choose a subject',
        'Do a value study',
        'Paint it',
        'Stop before you overwork it'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 5,
    tiers: [
      tier(1, 'Paint on a surface, regularly.', [req.days(7)]),
      tier(2, 'Mixing colour deliberately rather than hopefully.', [req.days(30), req.tasks('limited-palette')]),
      tier(3, 'One finished piece you are not embarrassed by.', [req.days(90), req.project('finished-piece')]),
      tier(4, 'Knowing when a painting is done.', [req.days(180), req.streak(14)]),
      tier(5, 'A body of work, not a pile of studies.', [req.days(365)])
    ]
  }),

  skill({
    id: 'photography',
    name: 'Photography',
    icon: '📷',
    description: 'Light, timing and taking far more photographs than you keep.',
    habitIds: ['take-photos', 'creative-play', 'get-outside'],
    starterTasks: [
      task('manual-mode', 'Shoot in manual for a week', 'Aperture, shutter, ISO — until it is boring.', 'high'),
      task('one-lens', 'Use one focal length for a month', 'Constraint teaches composition.')
    ],
    starterProjects: [
      project('photo-series', 'Make a series of ten photographs', 'One subject, one idea, ten frames that belong together.', [
        'Choose a single subject or theme',
        'Shoot widely',
        'Edit down to ten',
        'Sequence them'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 6,
    tiers: [
      tier(1, 'Carrying a camera and using it.', [req.days(7)]),
      tier(2, 'Exposure is a decision, not an accident.', [req.days(30), req.tasks('manual-mode')]),
      tier(3, 'A coherent series rather than a folder of singles.', [req.days(90), req.project('photo-series')]),
      tier(4, 'Editing ruthlessly — the skill nobody talks about.', [req.days(180), req.tasks('one-lens')]),
      tier(5, 'A recognisable way of seeing.', [req.days(365)])
    ]
  }),

  skill({
    id: 'woodworking',
    name: 'Woodworking',
    icon: '🪵',
    description: 'Sharp tools, square cuts and patience.',
    habitIds: ['woodworking-practice', 'ship-something'],
    starterTasks: [
      task('sharpen', 'Learn to sharpen a chisel', 'Everything downstream depends on it.', 'high'),
      task('square-cut', 'Cut fifty square ends', 'By hand. It is the whole craft in miniature.')
    ],
    starterProjects: [
      project('first-build', 'Build one useful thing', 'A box, a shelf, a stool — something that gets used.', [
        'Choose a simple project',
        'Mill the stock square',
        'Cut the joinery',
        'Finish it'
      ])
    ],
    campaignTemplateIds: ['deep-work-4w'],
    sortIndex: 7,
    tiers: [
      tier(1, 'In the workshop regularly.', [req.days(7)]),
      tier(2, 'Tools sharp, cuts square.', [req.days(30), req.tasks('sharpen', 'square-cut')]),
      tier(3, 'One finished piece in use.', [req.days(90), req.project('first-build')]),
      tier(4, 'Joinery that holds without apology.', [req.days(180)]),
      tier(5, 'Designing your own work rather than following plans.', [req.days(365)])
    ]
  }),

  skill({
    id: 'sewing',
    name: 'Sewing & Knitting',
    icon: '🧵',
    description: 'Making and mending your own things.',
    habitIds: ['sewing-practice', 'ship-something'],
    starterTasks: [
      task('mend-something', 'Mend one thing you would have thrown away', 'The fastest way to see the point.', 'high'),
      task('learn-stitches', 'Learn four stitches properly', 'Then everything else is a combination of them.')
    ],
    starterProjects: [
      project('first-garment', 'Make something wearable', 'A simple pattern, finished properly.', [
        'Choose a beginner pattern',
        'Make a toile first',
        'Cut and sew the real thing',
        'Finish the seams properly'
      ])
    ],
    campaignTemplateIds: ['no-zero-days-14'],
    sortIndex: 8,
    tiers: [
      tier(1, 'Working on something most days.', [req.days(7)]),
      tier(2, 'Repairs instead of replacements.', [req.days(30), req.tasks('mend-something')]),
      tier(3, 'Something you made, worn in public.', [req.days(90), req.project('first-garment')]),
      tier(4, 'Adjusting patterns to fit you rather than the other way round.', [req.days(180)]),
      tier(5, 'Making what you want, not what the pattern offers.', [req.days(365)])
    ]
  })
]);

export const CRAFT: SkillSection = {
  category: {
    id: CAT,
    name: 'Craft & Making',
    icon: '🎨',
    description: 'Instruments, images and things made by hand.',
    accent: 'from-fuchsia-400 to-purple-600'
  },
  skills
};
