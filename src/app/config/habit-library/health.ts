import { LibrarySection, group, habit, sub } from './types';

/** Nutrition, sleep and the maintenance habits that hold the rest up. */

const CAT = 'health';

const hydration = group(CAT, 'hydration', [
  habit('water-8', 'Drink 8 glasses of water', '💧', 'Spread across the day.', {
    difficulty: 'easy',
    points: 10,
    goal: 8,
    unit: 'glasses',
    tags: ['hydration'],
    guidance: {
      tips: [
        'Keep a bottle in sight — visibility does most of the work.',
        'One glass on waking replaces what you lost overnight.'
      ]
    }
  }),
  habit('water-on-waking', 'A glass of water on waking', '🌅', 'Before the coffee.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'glass',
    tags: ['hydration', 'morning']
  }),
  habit('no-sugary-drinks', 'No sugary drinks', '🥤', 'Fizzy drinks, energy drinks, sweet coffees.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['nutrition', 'avoid'],
    guidance: { summary: 'The easiest large calorie cut most people can make.' }
  }),
  habit('limit-caffeine', 'No caffeine after 2pm', '☕', 'It lingers far longer than it feels.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['sleep', 'avoid'],
    guidance: {
      summary: 'Caffeine has a half-life of about five hours — an afternoon coffee is still working at bedtime.'
    }
  }),
  habit('no-alcohol', 'No alcohol', '🚫', 'A dry day.', {
    type: 'bad',
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'day',
    tags: ['avoid', 'sobriety']
  })
]);

const eating = group(CAT, 'eating', [
  habit('vegetables', 'Vegetables at two meals', '🥦', 'Easier to add than to restrict.', {
    points: 10,
    goal: 2,
    unit: 'meals',
    tags: ['nutrition']
  }),
  habit('protein-every-meal', 'Protein with every meal', '🍳', 'Makes training actually count.', {
    points: 10,
    goal: 3,
    unit: 'meals',
    tags: ['nutrition', 'muscle'],
    guidance: {
      summary: 'Roughly a palm-sized portion per meal is a good rule without weighing anything.'
    }
  }),
  habit('no-junk-food', 'No junk food', '🍔', 'Processed and ultra-sweet foods.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['nutrition', 'avoid']
  }),
  habit('no-late-eating', 'No eating after 8pm', '🌙', 'Helps sleep more than most things.', {
    type: 'bad',
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['nutrition', 'sleep', 'avoid']
  }),
  habit('mindful-eating', 'Eat without a screen', '🍽️', 'No phone, no TV, just the meal.', {
    points: 10,
    goal: 1,
    unit: 'meal',
    tags: ['nutrition', 'mindfulness'],
    guidance: { summary: 'You notice fullness far sooner when you are actually paying attention.' }
  }),
  habit('log-food', 'Log what you ate', '📋', 'Awareness does most of the work.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['nutrition', 'tracking']
  }),
  habit('fruit', 'Eat fruit', '🍎', 'Two pieces a day.', {
    difficulty: 'easy',
    points: 5,
    goal: 2,
    unit: 'pieces',
    tags: ['nutrition']
  }),
  habit('meat-free-meal', 'Meat-free meal', '🥬', 'One a day makes a real difference.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'meal',
    tags: ['nutrition', 'environment']
  }),
  habit('no-snacking', 'No snacking between meals', '🍪', 'Eat at meals, not around them.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['nutrition', 'avoid']
  }),
  habit('intermittent-fasting', 'Keep the eating window', '⏱️', 'Stick to your chosen hours.', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['nutrition'],
    guidance: {
      safety: 'Not appropriate for everyone. Skip it if you are pregnant, diabetic or have a history of disordered eating.'
    }
  })
]);

const cooking = group(CAT, 'cooking', [
  habit('cook-at-home', 'Cook at home', '🍳', 'You control what goes in.', {
    points: 15,
    goal: 1,
    unit: 'meal',
    tags: ['cooking', 'nutrition']
  }),
  habit('meal-prep', 'Meal prep', '🥡', 'Cook once, eat several times.', {
    points: 20,
    goal: 60,
    unit: 'minutes',
    tags: ['cooking', 'planning'],
    guidance: { summary: 'The habit that makes every other nutrition habit easier to keep.' }
  }),
  habit('plan-meals', 'Plan the week\'s meals', '📅', 'Decide before you are hungry.', {
    points: 10,
    goal: 1,
    unit: 'week',
    tags: ['cooking', 'planning']
  }),
  habit('shopping-list', 'Shop from a list', '🛒', 'Buy what you planned, not what you see.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'trip',
    tags: ['cooking', 'finance']
  }),
  habit('baking-practice', 'Bake', '🥖', 'Bread, pastry or cake — weighed, not guessed.', {
    points: 15,
    goal: 60,
    unit: 'minutes',
    tags: ['cooking', 'creative'],
    guidance: {
      summary: 'Baking is chemistry. Weigh everything; volume measures are why the same recipe works twice and fails once.'
    }
  }),
  habit('grilling-practice', 'Cook over fire', '🔥', 'Grill, barbecue or smoke something.', {
    points: 15,
    goal: 45,
    unit: 'minutes',
    tags: ['cooking'],
    guidance: {
      safety: 'Cook to temperature, not to time or colour. A thermometer is the whole difference with poultry and pork.'
    }
  }),
  habit('coffee-practice', 'Make coffee deliberately', '☕', 'Weigh, time, taste, adjust one variable.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'brew',
    tags: ['cooking', 'practice'],
    guidance: { tips: ['Change one variable at a time or you learn nothing from the result.'] }
  }),
  habit('try-new-recipe', 'Try a new recipe', '📖', 'Keep cooking from getting boring.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'recipe',
    tags: ['cooking', 'creative']
  })
]);

const sleepSchedule = group(CAT, 'sleep', [
  habit('lights-out', 'Lights out by 11pm', '🌙', 'Consistency beats duration.', {
    tracking: {
      kind: 'time-of-day',
      target: 23 * 60,
      direction: 'before',
      prompt: 'What time were the lights out?'
    },
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'day',
    tags: ['sleep'],
    guidance: {
      summary: 'A consistent bedtime matters more than the exact hour you pick.'
    }
  }),
  habit('same-wake-time', 'Same wake time daily', '⏰', 'Weekends included.', {
    // The point of this habit is the TIME, not the tick. Logging 06:40 every
    // day is what shows the schedule holding; a streak of ticks hides a slide
    // from 06:00 to 08:00 completely.
    tracking: {
      kind: 'time-of-day',
      target: 7 * 60,
      direction: 'before',
      prompt: 'What time did you wake up?'
    },
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['sleep'],
    guidance: {
      summary: 'The anchor everything else hangs on — fix this before anything else about sleep.'
    }
  }),
  habit('sleep-7-hours', 'Sleep 7+ hours', '😴', 'Actual sleep, not time in bed.', {
    tracking: { kind: 'duration', unit: 'hours', target: 7, direction: 'at-least', step: 1, min: 0, max: 14 },
    points: 15,
    goal: 7,
    unit: 'hours',
    tags: ['sleep']
  }),
  habit('no-screens-before-bed', 'No screens an hour before bed', '📵', 'Read something on paper.', {
    type: 'bad',
    difficulty: 'hard',
    points: 20,
    goal: 1,
    unit: 'day',
    tags: ['sleep', 'avoid']
  }),
  habit('wind-down', 'Wind-down routine', '🕯️', 'The same sequence every night.', {
    difficulty: 'easy',
    points: 10,
    goal: 20,
    unit: 'minutes',
    tags: ['sleep'],
    guidance: {
      summary: 'Repetition is the point — the routine becomes the signal.',
      tips: ['Dim the lights, same order, same finish time.']
    }
  }),
  habit('no-snooze', 'No snoozing', '⏰', 'Up on the first alarm.', {
    type: 'bad',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['sleep', 'avoid'],
    guidance: { summary: 'Fragmented snooze sleep leaves you groggier than just getting up.' }
  }),
  habit('cool-dark-room', 'Cool, dark bedroom', '🌡️', 'Around 18°C and properly dark.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['sleep', 'environment']
  }),
  habit('no-phone-in-bedroom', 'Phone out of the bedroom', '📱', 'Charge it in another room.', {
    type: 'bad',
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['sleep', 'avoid']
  }),
  habit('morning-light', 'Get morning daylight', '☀️', 'Ten minutes outside early.', {
    difficulty: 'easy',
    points: 10,
    goal: 10,
    unit: 'minutes',
    tags: ['sleep', 'outdoors'],
    guidance: { summary: 'Morning light sets the clock that decides when you get sleepy.' }
  })
]);

const selfCare = group(CAT, 'self-care', [
  habit('get-outside', 'Get outside', '🌳', 'Daylight, even briefly.', {
    difficulty: 'easy',
    points: 10,
    goal: 20,
    unit: 'minutes',
    tags: ['outdoors', 'wellbeing']
  }),
  habit('offline-time', '30 minutes offline', '🔌', 'No screens of any kind.', {
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['wellbeing', 'digital']
  }),
  habit('skincare', 'Skincare routine', '🧴', 'Morning or evening.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['hygiene']
  }),
  habit('floss', 'Floss', '🦷', 'The one everybody lies about.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['hygiene']
  }),
  habit('take-medication', 'Take medication', '💊', 'On time, as prescribed.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['health', 'medical']
  }),
  habit('take-vitamins', 'Take supplements', '💊', 'Whatever you actually need.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['health']
  }),
  habit('posture-check', 'Posture check', '🪑', 'Reset how you are sitting.', {
    difficulty: 'easy',
    points: 5,
    goal: 3,
    unit: 'times',
    tags: ['health', 'desk']
  }),
  habit('stand-up-hourly', 'Stand up every hour', '🧍', 'Break up long sitting.', {
    difficulty: 'easy',
    points: 10,
    goal: 8,
    unit: 'times',
    tags: ['health', 'desk']
  }),
  habit('eye-breaks', '20-20-20 eye breaks', '👀', 'Every 20 minutes, look 20 feet away for 20 seconds.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['health', 'desk']
  }),
  habit('no-smoking', 'No smoking or vaping', '🚭', 'A clear day.', {
    type: 'bad',
    difficulty: 'hard',
    points: 25,
    goal: 1,
    unit: 'day',
    tags: ['avoid', 'sobriety']
  }),
  habit('doctor-checkup', 'Book the appointment', '🩺', 'The one you keep putting off.', {
    points: 15,
    goal: 1,
    unit: 'appointment',
    tags: ['medical', 'admin']
  }),
  habit('sunscreen', 'Wear sunscreen', '🧴', 'Every day, not just sunny ones.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['hygiene', 'prevention']
  })
]);

export const HEALTH: LibrarySection = {
  category: {
    id: CAT,
    name: 'Health & Nutrition',
    icon: '🥗',
    description: 'Eating, drinking, sleeping and looking after the machine.',
    accent: 'from-lime-400 to-emerald-600',
    subcategories: [
      sub('hydration', 'Hydration & drinks', '💧', 'Water, caffeine and what to cut.'),
      sub('eating', 'Eating habits', '🍽️', 'What and how you eat.'),
      sub('cooking', 'Cooking & prep', '🍳', 'Planning, shopping and cooking.'),
      sub('sleep', 'Sleep', '😴', 'Schedule, wind-down and environment.'),
      sub('self-care', 'Self-care', '🛁', 'Hygiene, screens, posture and medical.')
    ]
  },
  habits: [...hydration, ...eating, ...cooking, ...sleepSchedule, ...selfCare]
};
