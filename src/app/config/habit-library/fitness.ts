import { LibrarySection, group, habit, sub } from './types';

/**
 * Fitness.
 *
 * The most heavily subdivided category, because "exercise" is not one habit —
 * someone running a push/pull/legs split needs different entries from someone
 * walking daily, and both need to find theirs quickly.
 *
 * Compound lifts carry full form guidance: they are the ones where doing it
 * wrong causes injury rather than just wasted effort.
 */

const CAT = 'fitness';

const push = group(CAT, 'push', [
  habit('bench-press', 'Bench press', '🏋️', 'Barbell press from the chest.', {
    tracking: {
      kind: 'measure',
      unit: 'kg',
      direction: 'at-least',
      step: 2.5,
      min: 0,
      prompt: 'Heaviest working set (kg)?'
    },
    difficulty: 'hard',
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'chest', 'barbell'],
    guidance: {
      summary: 'Big chest and triceps builder. Control matters far more than load.',
      equipment: ['Barbell', 'Bench', 'Rack', 'Safety pins or a spotter'],
      muscles: ['Chest', 'Front deltoids', 'Triceps'],
      steps: [
        'Lie back with eyes under the bar. Plant both feet flat.',
        'Grip a little wider than shoulder width, wrists stacked over elbows.',
        'Pull your shoulder blades down and together, and keep them there.',
        'Unrack, bring the bar over your lower chest, elbows about 45° from your body.',
        'Lower under control until the bar touches your chest — no bouncing.',
        'Press back up and slightly toward your face, finishing over the shoulders.'
      ],
      tips: [
        'Squeeze the bar hard — it recruits more of the arm and stabilises the wrist.',
        'Drive your feet into the floor; the press starts from the ground.',
        'Leave a rep in reserve when training without a spotter.'
      ],
      mistakes: [
        'Flaring elbows straight out to 90°, which puts the shoulder at risk.',
        'Bouncing the bar off the chest instead of pausing under control.',
        'Lifting the hips off the bench to shorten the range.'
      ],
      safety: 'Use safety pins or a spotter. A failed bench press is the one lift you cannot escape.',
      media: { searchQuery: 'proper barbell bench press form' }
    }
  }),
  habit('overhead-press', 'Overhead press', '🏋️', 'Press a bar or dumbbells overhead.', {
    difficulty: 'hard',
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'shoulders'],
    guidance: {
      summary: 'The honest test of shoulder strength — there is nowhere to hide.',
      equipment: ['Barbell or dumbbells'],
      muscles: ['Deltoids', 'Triceps', 'Upper chest', 'Core'],
      steps: [
        'Stand with feet hip-width, bar resting on the front deltoids.',
        'Grip just outside the shoulders, elbows slightly in front of the bar.',
        'Brace your abs and squeeze your glutes so the ribs stay down.',
        'Move your head back slightly and press the bar straight up past your face.',
        'As the bar clears your forehead, push your head back through.',
        'Finish with the bar over the middle of your foot, arms locked.'
      ],
      tips: [
        'If the bar drifts forward, you are pressing around your head instead of past it.',
        'Squeeze the glutes — it is what stops the lower back arching.'
      ],
      mistakes: [
        'Leaning back to turn it into an incline press.',
        'Letting the ribs flare, which stresses the lower back.'
      ],
      safety: 'Any sharp shoulder pinching means stop and reassess the grip width.',
      media: { searchQuery: 'standing overhead press form' }
    }
  }),
  habit('push-ups', 'Push-ups', '💪', 'Bodyweight pressing, anywhere, no kit.', {
    points: 10,
    goal: 30,
    unit: 'reps',
    tags: ['bodyweight', 'chest'],
    guidance: {
      summary: 'One straight line from head to heels, moving as a single piece.',
      equipment: [],
      muscles: ['Chest', 'Triceps', 'Front deltoids', 'Core'],
      steps: [
        'Hands slightly wider than shoulders, under the upper chest.',
        'Squeeze the glutes and brace the abs so the hips do not sag.',
        'Lower until the chest is a fist from the floor, elbows about 45°.',
        'Press back up without letting the hips lead.'
      ],
      tips: [
        'Too hard? Raise the hands onto a bench or step rather than dropping to the knees.',
        'Too easy? Slow the lowering to three seconds before adding reps.'
      ],
      mistakes: ['Sagging hips', 'Head dropping toward the floor first', 'Half range of motion'],
      media: { searchQuery: 'perfect push up form' }
    }
  }),
  habit('dips', 'Dips', '🤸', 'Parallel bar or bench dips.', {
    difficulty: 'hard',
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['bodyweight', 'triceps'],
    guidance: {
      summary: 'Lean forward for chest, stay upright for triceps.',
      equipment: ['Parallel bars or a sturdy bench'],
      muscles: ['Chest', 'Triceps', 'Front deltoids'],
      steps: [
        'Support yourself on straight arms, shoulders pulled down away from the ears.',
        'Lower until the upper arm is roughly parallel to the floor.',
        'Press back up without shrugging at the top.'
      ],
      mistakes: ['Going far deeper than shoulder comfort allows', 'Shrugging at the top'],
      safety: 'Stop at the depth where the shoulder feels stable. Depth is not the goal.',
      media: { searchQuery: 'parallel bar dip form' }
    }
  }),
  habit('incline-press', 'Incline press', '🏋️', 'Pressing on a 30° incline.', {
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'chest'],
    guidance: {
      summary: 'Shifts the work toward the upper chest and shoulders.',
      equipment: ['Adjustable bench', 'Barbell or dumbbells'],
      muscles: ['Upper chest', 'Front deltoids', 'Triceps'],
      tips: ['Above about 45° it becomes a shoulder press — keep the bench low.']
    }
  }),
  habit('lateral-raise', 'Lateral raises', '🦅', 'Isolation for the side delts.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['shoulders', 'accessory'],
    guidance: {
      summary: 'Light weight, strict form. This one is not a strength lift.',
      muscles: ['Side deltoids'],
      mistakes: ['Swinging with the lower back', 'Going far above shoulder height']
    }
  }),
  habit('tricep-work', 'Triceps work', '💪', 'Pushdowns, extensions or skullcrushers.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['arms', 'accessory']
  }),
  habit('push-day', 'Push day', '🏋️', 'A full chest, shoulders and triceps session.', {
    difficulty: 'hard',
    points: 25,
    goal: 60,
    unit: 'minutes',
    tags: ['split', 'session'],
    guidance: {
      summary: 'One heavy press, one secondary press, then two or three accessories.',
      tips: [
        'Order it heaviest first, while you are freshest.',
        'Two hard sets taken close to failure beat five easy ones.'
      ]
    }
  })
]);

const pull = group(CAT, 'pull', [
  habit('deadlift', 'Deadlift', '🏋️', 'Lift a loaded bar from the floor.', {
    // Weight on the bar, not sets — this is the number that shows progress.
    tracking: {
      kind: 'measure',
      unit: 'kg',
      direction: 'at-least',
      step: 2.5,
      min: 0,
      prompt: 'Heaviest working set (kg)?'
    },
    difficulty: 'hard',
    points: 25,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'posterior-chain', 'barbell'],
    guidance: {
      summary:
        'The whole back and legs in one movement. Technique is not optional here — a rounded-back deadlift is the classic way to injure yourself in a gym.',
      equipment: ['Barbell', 'Plates'],
      muscles: ['Glutes', 'Hamstrings', 'Spinal erectors', 'Lats', 'Forearms'],
      steps: [
        'Stand with the bar over the middle of your foot, about an inch from your shins.',
        'Hinge at the hips and grip just outside your legs.',
        'Drop your hips until your shins touch the bar — no lower.',
        'Lift your chest and flatten your back. Take the slack out of the bar until it clicks.',
        'Squeeze your armpits to engage the lats and hold the bar close.',
        'Push the floor away with your legs; let the bar drag up your shins.',
        'Stand tall by squeezing the glutes. Do not lean back at the top.',
        'Return it by pushing the hips back first, then bending the knees.'
      ],
      tips: [
        'Think "push the floor away", not "pull the bar up".',
        'The bar should stay in contact with your legs the whole way.',
        'Breathe in at the top, brace, hold it for the rep, then breathe out.',
        'Reset your position between reps rather than bouncing off the floor.'
      ],
      mistakes: [
        'Rounding the lower back — the single most common cause of injury here.',
        'Starting with hips too low, turning it into a squat you cannot finish.',
        'Letting the bar drift away from the shins, which multiplies the load on your back.',
        'Jerking the bar off the floor before taking the slack out.',
        'Hyperextending at the top, which loads the spine for no benefit.'
      ],
      safety:
        'Stop the set the moment your lower back rounds. Ego lifting here has a long recovery. Learn it light with someone watching before adding weight.',
      media: { searchQuery: 'conventional deadlift proper form tutorial' }
    }
  }),
  habit('pull-ups', 'Pull-ups', '🧗', 'Pull your chin over a bar.', {
    difficulty: 'hard',
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['bodyweight', 'back'],
    guidance: {
      summary: 'The best measure of relative upper-body strength there is.',
      equipment: ['Pull-up bar', 'Resistance band if assistance is needed'],
      muscles: ['Lats', 'Biceps', 'Mid-back', 'Core'],
      steps: [
        'Hang with hands just outside shoulder width, arms straight.',
        'Pull your shoulder blades down first — the arms follow.',
        'Drive your elbows toward your ribs until your chin clears the bar.',
        'Lower all the way under control to a full hang.'
      ],
      tips: [
        'Cannot do one yet? Use a band, or do slow negatives from the top.',
        'Squeeze the glutes to stop the legs swinging.'
      ],
      mistakes: ['Kipping without meaning to', 'Half reps', 'Missing the full hang at the bottom'],
      media: { searchQuery: 'strict pull up form' }
    }
  }),
  habit('barbell-row', 'Barbell row', '🏋️', 'Row a bar to the stomach.', {
    difficulty: 'hard',
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'back'],
    guidance: {
      summary: 'Builds the whole back and props up your deadlift and bench.',
      equipment: ['Barbell'],
      muscles: ['Lats', 'Rhomboids', 'Rear deltoids', 'Biceps'],
      steps: [
        'Hinge forward to roughly 45°, back flat, knees softly bent.',
        'Let the bar hang at arms length.',
        'Row it to your lower ribs, elbows tracking back rather than out.',
        'Lower under control without letting the chest collapse.'
      ],
      mistakes: ['Standing up as the weight gets heavy', 'Yanking with the lower back'],
      safety: 'Keep the back flat. If it rounds, the weight is too heavy.',
      media: { searchQuery: 'barbell row proper form' }
    }
  }),
  habit('lat-pulldown', 'Lat pulldown', '🎣', 'Machine pulling from overhead.', {
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['back', 'machine'],
    guidance: {
      summary: 'The pull-up substitute you can load precisely.',
      muscles: ['Lats', 'Biceps'],
      mistakes: ['Leaning far back to turn it into a row', 'Pulling behind the neck']
    }
  }),
  habit('face-pulls', 'Face pulls', '🎯', 'Rope pulls to the face for the rear delts.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['shoulders', 'posture', 'accessory'],
    guidance: {
      summary: 'The best cheap insurance against shoulder problems and desk posture.',
      muscles: ['Rear deltoids', 'Rotator cuff', 'Mid-back'],
      tips: ['Go light and squeeze at the end. This is not a strength movement.']
    }
  }),
  habit('bicep-work', 'Biceps work', '💪', 'Curls, hammer curls or chin-ups.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['arms', 'accessory']
  }),
  habit('pull-day', 'Pull day', '🧗', 'A full back and biceps session.', {
    difficulty: 'hard',
    points: 25,
    goal: 60,
    unit: 'minutes',
    tags: ['split', 'session'],
    guidance: {
      summary: 'One vertical pull, one horizontal pull, then arms and rear delts.'
    }
  })
]);

const legs = group(CAT, 'legs', [
  habit('back-squat', 'Back squat', '🦵', 'Barbell squat with the bar on your back.', {
    tracking: {
      kind: 'measure',
      unit: 'kg',
      direction: 'at-least',
      step: 2.5,
      min: 0,
      prompt: 'Heaviest working set (kg)?'
    },
    difficulty: 'hard',
    points: 25,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'legs', 'barbell'],
    guidance: {
      summary: 'The whole lower body at once, and the lift most worth learning properly.',
      equipment: ['Barbell', 'Squat rack with safety pins'],
      muscles: ['Quadriceps', 'Glutes', 'Adductors', 'Core'],
      steps: [
        'Set the bar just below shoulder height. Get under it and squeeze your shoulder blades to make a shelf.',
        'Step back with two or three steps — no more.',
        'Feet shoulder-width, toes turned slightly out.',
        'Breathe in, brace your abs as if about to be punched.',
        'Sit down and slightly back, letting the knees travel forward over the toes.',
        'Descend until the hip crease passes the knee, if your mobility allows.',
        'Drive up through the whole foot, keeping the chest up.'
      ],
      tips: [
        'Push your knees out in line with your toes on the way up.',
        'Look at a point on the floor a few metres ahead, not at the ceiling.',
        'If your heels lift, try shoes with a firm sole or work on ankle mobility.'
      ],
      mistakes: [
        'Knees caving inward under load.',
        'The hips shooting up first, turning it into a good morning.',
        'Bouncing out of the bottom.',
        'Setting the safety pins too low to catch a failed rep.'
      ],
      safety: 'Always set safety pins at the bottom of your range. Learn to bail before you need to.',
      media: { searchQuery: 'back squat proper form tutorial' }
    }
  }),
  habit('front-squat', 'Front squat', '🦵', 'Squat with the bar on the front deltoids.', {
    difficulty: 'hard',
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['strength', 'legs', 'quads'],
    guidance: {
      summary: 'More upright, more quads, far less forgiving of a lazy torso.',
      muscles: ['Quadriceps', 'Upper back', 'Core'],
      tips: ['Elbows high throughout — if they drop, the bar rolls forward.']
    }
  }),
  habit('romanian-deadlift', 'Romanian deadlift', '🏋️', 'Hip hinge with soft knees.', {
    points: 20,
    goal: 3,
    unit: 'sets',
    tags: ['hamstrings', 'glutes'],
    guidance: {
      summary: 'The hamstring builder. Range comes from the hips, never the spine.',
      muscles: ['Hamstrings', 'Glutes', 'Spinal erectors'],
      steps: [
        'Stand tall holding the bar at the hips, knees slightly bent.',
        'Push your hips backwards and let the bar slide down your thighs.',
        'Stop when you feel a strong hamstring stretch — usually around the knee.',
        'Drive the hips forward to stand up.'
      ],
      mistakes: ['Bending the knees more to reach lower', 'Rounding the back to chase depth'],
      media: { searchQuery: 'romanian deadlift form' }
    }
  }),
  habit('lunges', 'Lunges', '🚶', 'Walking, reverse or split lunges.', {
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['legs', 'unilateral'],
    guidance: {
      summary: 'Fixes side-to-side imbalances a barbell lets you hide.',
      muscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
      tips: ['Reverse lunges are kinder to the knees than forward ones.']
    }
  }),
  habit('leg-press', 'Leg press', '🦿', 'Machine pressing for the legs.', {
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['legs', 'machine'],
    guidance: {
      mistakes: ['Locking the knees hard at the top', 'Letting the lower back round at the bottom']
    }
  }),
  habit('calf-raises', 'Calf raises', '🦵', 'Standing or seated calf work.', {
    difficulty: 'easy',
    points: 5,
    goal: 3,
    unit: 'sets',
    tags: ['legs', 'accessory'],
    guidance: { tips: ['Pause at the top and lower slowly — calves respond to time under tension.'] }
  }),
  habit('glute-bridge', 'Glute bridges', '🍑', 'Hip thrusts or floor bridges.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['glutes'],
    guidance: {
      muscles: ['Glutes', 'Hamstrings'],
      tips: ['Squeeze at the top and keep the ribs down rather than arching the lower back.']
    }
  }),
  habit('leg-day', 'Leg day', '🦵', 'A full lower-body session.', {
    difficulty: 'hard',
    points: 25,
    goal: 60,
    unit: 'minutes',
    tags: ['split', 'session'],
    guidance: { summary: 'One squat pattern, one hinge, one single-leg, then calves.' }
  })
]);

const core = group(CAT, 'core', [
  habit('plank', 'Plank', '🧱', 'Hold a rigid straight-body position.', {
    tracking: { kind: 'duration', unit: 'seconds', target: 60, direction: 'at-least', step: 15, min: 0 },
    difficulty: 'easy',
    points: 10,
    goal: 60,
    unit: 'seconds',
    tags: ['core', 'bodyweight'],
    guidance: {
      summary: 'Bracing practice, not an endurance contest.',
      steps: [
        'Elbows under shoulders, forearms flat.',
        'Squeeze the glutes and tuck the ribs down.',
        'Hold a straight line from head to heels, breathing normally.'
      ],
      mistakes: ['Hips sagging or piked up', 'Holding your breath'],
      tips: ['Thirty hard seconds beats three soft minutes.']
    }
  }),
  habit('dead-bug', 'Dead bugs', '🐞', 'Opposite arm and leg, back flat.', {
    difficulty: 'easy',
    points: 10,
    goal: 3,
    unit: 'sets',
    tags: ['core', 'stability'],
    guidance: {
      summary: 'Teaches the core to stay braced while the limbs move.',
      mistakes: ['Letting the lower back arch off the floor']
    }
  }),
  habit('hanging-leg-raise', 'Hanging leg raises', '🧗', 'Raise the legs while hanging.', {
    difficulty: 'hard',
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['core'],
    guidance: { mistakes: ['Swinging', 'Using momentum instead of the abs'] }
  }),
  habit('ab-wheel', 'Ab wheel rollouts', '⚙️', 'Roll out and back with a wheel.', {
    difficulty: 'hard',
    points: 15,
    goal: 3,
    unit: 'sets',
    tags: ['core'],
    guidance: {
      safety: 'Only roll as far as you can keep the lower back flat.',
      mistakes: ['Arching the lower back at full extension']
    }
  }),
  habit('side-plank', 'Side plank', '📐', 'Hold on one forearm, hips stacked.', {
    difficulty: 'easy',
    points: 10,
    goal: 45,
    unit: 'seconds',
    tags: ['core', 'obliques']
  }),
  habit('carries', 'Loaded carries', '🧳', 'Walk holding heavy weight.', {
    points: 15,
    goal: 4,
    unit: 'sets',
    tags: ['core', 'grip', 'conditioning'],
    guidance: {
      summary: 'The most transferable core work there is — everything has to hold.',
      tips: ['Walk tall, shoulders down, ribs stacked over hips.']
    }
  })
]);

const fullBody = group(CAT, 'full-body', [
  habit('full-body-session', 'Full-body session', '🏋️', 'One session hitting everything.', {
    difficulty: 'hard',
    points: 25,
    goal: 45,
    unit: 'minutes',
    tags: ['session'],
    guidance: {
      summary: 'The most efficient plan for two or three days a week.',
      tips: ['One squat, one hinge, one push, one pull, one carry.']
    }
  }),
  habit('kettlebell-swing', 'Kettlebell swings', '🔔', 'Explosive hip hinge with a kettlebell.', {
    points: 15,
    goal: 5,
    unit: 'sets',
    tags: ['conditioning', 'posterior-chain'],
    guidance: {
      summary: 'A hinge, not a squat, and not a front raise — the arms just hold on.',
      steps: [
        'Stand with the bell a foot in front of you.',
        'Hinge and hike it back between your legs like a rugby pass.',
        'Snap the hips forward hard; the bell floats to chest height.',
        'Let it fall, absorb it by hinging again.'
      ],
      mistakes: ['Squatting instead of hinging', 'Lifting the bell with the shoulders'],
      media: { searchQuery: 'kettlebell swing hinge form' }
    }
  }),
  habit('burpees', 'Burpees', '🔥', 'Squat, plank, push-up, jump.', {
    difficulty: 'hard',
    points: 15,
    goal: 50,
    unit: 'reps',
    tags: ['conditioning', 'bodyweight']
  }),
  habit('circuit-training', 'Circuit training', '🔄', 'Rounds of movements with little rest.', {
    points: 20,
    goal: 30,
    unit: 'minutes',
    tags: ['conditioning']
  }),
  habit('bodyweight-workout', 'Bodyweight workout', '🤸', 'Train with no equipment at all.', {
    difficulty: 'easy',
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['bodyweight'],
    guidance: { summary: 'Push-ups, squats, lunges, planks. No excuses about kit or travel.' }
  })
]);

const cardio = group(CAT, 'cardio', [
  habit('run', 'Go for a run', '🏃', 'Any distance, any pace.', {
    tracking: { kind: 'duration', unit: 'minutes', target: 30, direction: 'at-least', step: 5, min: 0 },
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['cardio', 'endurance'],
    guidance: {
      summary: 'Most runs should be easy enough to hold a conversation.',
      tips: [
        'Increase weekly distance by roughly 10% at a time.',
        'Cadence around 170–180 steps a minute reduces impact.'
      ],
      mistakes: ['Running every session hard', 'Adding distance too quickly']
    }
  }),
  habit('walk-10k', '10,000 steps', '👟', 'Hit a daily step count.', {
    tracking: { kind: 'count', unit: 'steps', target: 10000, direction: 'at-least', step: 500, min: 0 },
    difficulty: 'easy',
    points: 10,
    goal: 10000,
    unit: 'steps',
    tags: ['cardio', 'low-impact']
  }),
  habit('cycle', 'Cycle', '🚴', 'Road, trail or stationary.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['cardio', 'low-impact']
  }),
  habit('swim', 'Swim', '🏊', 'Laps or open water.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['cardio', 'low-impact']
  }),
  habit('rowing', 'Row', '🚣', 'Erg or on the water.', {
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['cardio', 'full-body'],
    guidance: {
      summary: 'Legs, then body, then arms — and the exact reverse coming back.',
      mistakes: ['Pulling with the arms first', 'Rushing back up the slide']
    }
  }),
  habit('hiit', 'HIIT session', '⚡', 'Short hard intervals with recovery.', {
    difficulty: 'hard',
    points: 20,
    goal: 20,
    unit: 'minutes',
    tags: ['cardio', 'intervals'],
    guidance: {
      summary: 'Genuinely hard intervals, genuinely easy recoveries.',
      safety: 'Two or three sessions a week is plenty. More is where injuries come from.'
    }
  }),
  habit('stairs', 'Take the stairs', '🪜', 'Skip the lift wherever you are.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['cardio', 'micro-habit']
  }),
  habit('zone-2', 'Zone 2 cardio', '❤️', 'Long steady effort at a conversational pace.', {
    points: 15,
    goal: 45,
    unit: 'minutes',
    tags: ['cardio', 'endurance'],
    guidance: {
      summary: 'Where the aerobic base is actually built. It should feel too easy.',
      tips: ['If you cannot speak in full sentences, slow down.']
    }
  })
]);

const mobility = group(CAT, 'mobility', [
  habit('stretch', 'Stretch', '🤸', 'Full-body stretching session.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['mobility', 'recovery'],
    guidance: {
      tips: ['Hold each position 30 seconds and breathe out into it.'],
      mistakes: ['Bouncing at end range', 'Stretching cold before heavy lifting']
    }
  }),
  habit('yoga', 'Yoga', '🧘', 'A yoga session of any style.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['mobility', 'mindfulness']
  }),
  habit('foam-roll', 'Foam rolling', '🎳', 'Roll out tight areas.', {
    difficulty: 'easy',
    points: 5,
    goal: 10,
    unit: 'minutes',
    tags: ['recovery']
  }),
  habit('hip-mobility', 'Hip mobility', '🦵', 'Openers for sitting all day.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['mobility'],
    guidance: { summary: 'The first thing to go if you sit for work, and the easiest to keep.' }
  }),
  habit('shoulder-mobility', 'Shoulder mobility', '💪', 'Dislocates, wall slides, band work.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['mobility', 'injury-prevention']
  }),
  habit('warm-up', 'Warm up properly', '🔥', 'Prepare before the working sets.', {
    difficulty: 'easy',
    points: 5,
    goal: 10,
    unit: 'minutes',
    tags: ['injury-prevention'],
    guidance: {
      summary: 'Five minutes easy cardio, then ramp-up sets of the first movement.',
      mistakes: ['Static stretching cold instead of moving']
    }
  })
]);

const recovery = group(CAT, 'recovery', [
  habit('rest-day', 'Take a real rest day', '🛌', 'No training, on purpose.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['recovery'],
    guidance: { summary: 'Adaptation happens between sessions, not during them.' }
  }),
  habit('deload-week', 'Deload week', '📉', 'A planned lighter week.', {
    points: 15,
    goal: 1,
    unit: 'week',
    tags: ['recovery', 'programming']
  }),
  habit('post-workout-stretch', 'Stretch after training', '🧘', 'The part everyone skips.', {
    difficulty: 'easy',
    points: 5,
    goal: 10,
    unit: 'minutes',
    tags: ['recovery']
  }),
  habit('no-training-through-pain', 'Stop when something hurts', '🛑', 'Sharp pain means stop.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['injury-prevention'],
    guidance: {
      safety: 'Muscle burn is fine. Sharp, joint or nerve pain is not — stop and get it looked at.'
    }
  })
]);

const sport = group(CAT, 'sport', [
  habit('team-sport', 'Play a team sport', '⚽', 'Football, basketball, hockey — anything.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['sport', 'social']
  }),
  habit('racket-sport', 'Racket sport', '🎾', 'Tennis, squash, badminton, padel.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['sport', 'social']
  }),
  habit('martial-arts', 'Martial arts', '🥋', 'Training or sparring.', {
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['sport', 'discipline']
  }),
  habit('climbing', 'Climbing', '🧗', 'Bouldering or roped climbing.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['sport', 'strength']
  }),
  habit('hike', 'Go for a hike', '🥾', 'Time on the trail.', {
    points: 20,
    goal: 90,
    unit: 'minutes',
    tags: ['outdoors', 'cardio']
  }),
  habit('dance-practice', 'Dance practice', '💃', 'Drills, choreography or social dancing.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['sport', 'creative', 'practice']
  }),
  habit('skill-practice', 'Practise a skill', '🎯', 'Drills for a specific technique.', {
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['sport', 'practice']
  })
]);

export const FITNESS: LibrarySection = {
  category: {
    id: CAT,
    name: 'Fitness & Training',
    icon: '🏋️',
    description: 'Strength, conditioning and everything that keeps you moving.',
    accent: 'from-rose-400 to-red-600',
    subcategories: [
      sub('push', 'Push', '💪', 'Chest, shoulders and triceps.'),
      sub('pull', 'Pull', '🧗', 'Back and biceps.'),
      sub('legs', 'Legs', '🦵', 'Squats, hinges and single-leg work.'),
      sub('core', 'Core', '🧱', 'Bracing, anti-rotation and carries.'),
      sub('full-body', 'Full body', '🔄', 'Sessions that hit everything at once.'),
      sub('cardio', 'Cardio', '🏃', 'Running, cycling, rowing and intervals.'),
      sub('mobility', 'Mobility', '🤸', 'Stretching, yoga and joint work.'),
      sub('recovery', 'Recovery', '🛌', 'Rest, deloads and staying uninjured.'),
      sub('sport', 'Sport', '⚽', 'Games, climbing and skill practice.')
    ]
  },
  habits: [...push, ...pull, ...legs, ...core, ...fullBody, ...cardio, ...mobility, ...recovery, ...sport]
};
