import { LibrarySection, group, habit, sub } from './types';

/** People, money, home and the world outside. */

const CAT = 'life';

const relationships = group(CAT, 'relationships', [
  habit('call-family', 'Call family', '📞', 'A real call beats ten texts.', {
    points: 15,
    goal: 15,
    unit: 'minutes',
    tags: ['family', 'social']
  }),
  habit('message-someone', 'Message someone you miss', '💌', 'One person, one message.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'message',
    tags: ['social']
  }),
  habit('meet-in-person', 'Meet someone in person', '🤝', 'Weekly is a good target.', {
    points: 15,
    goal: 1,
    unit: 'meeting',
    tags: ['social']
  }),
  habit('quality-time', 'Undistracted time with someone', '❤️', 'Phones away, properly present.', {
    points: 15,
    goal: 30,
    unit: 'minutes',
    tags: ['family', 'social']
  }),
  habit('thank-specifically', 'Thank someone specifically', '🙌', 'Name the thing they did.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'time',
    tags: ['social', 'gratitude']
  }),
  habit('listen-without-fixing', 'Listen without fixing it', '👂', 'Ask before offering solutions.', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['social', 'communication']
  }),
  habit('no-phone-at-dinner', 'No phone at the table', '📵', 'Meals are for the people at them.', {
    type: 'bad',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['family', 'avoid']
  }),
  habit('date-night', 'Date night', '💞', 'Planned, not improvised.', {
    points: 20,
    goal: 1,
    unit: 'evening',
    tags: ['relationship']
  }),
  habit('read-to-kids', 'Read to your kids', '📚', 'Twenty minutes at bedtime.', {
    difficulty: 'easy',
    points: 15,
    goal: 20,
    unit: 'minutes',
    tags: ['family', 'parenting']
  }),
  habit('apologise-properly', 'Apologise properly', '🕊️', 'No "but" in the sentence.', {
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['communication']
  })
]);

const community = group(CAT, 'community', [
  habit('volunteer', 'Volunteer', '🤲', 'Give time, not just money.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['community', 'giving']
  }),
  habit('random-kindness', 'One deliberate kindness', '💛', 'Small and unprompted.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'act',
    tags: ['community', 'giving']
  }),
  habit('donate', 'Give to a cause', '🎁', 'Regularly, not just at Christmas.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'donation',
    tags: ['giving', 'finance']
  }),
  habit('check-on-neighbour', 'Check on a neighbour', '🏘️', 'Especially the ones living alone.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'time',
    tags: ['community']
  }),
  habit('attend-community-event', 'Attend a local event', '🎪', 'Show up where you live.', {
    points: 15,
    goal: 1,
    unit: 'event',
    tags: ['community', 'social']
  }),
  habit('mentor-someone', 'Mentor someone', '🧭', 'Pass on what you know.', {
    points: 20,
    goal: 1,
    unit: 'session',
    tags: ['community', 'career']
  })
]);

const money = group(CAT, 'money', [
  habit('log-spending', 'Log today\'s spending', '🧾', 'Two minutes; the awareness does the work.', {
    tracking: { kind: 'currency', unit: '$', direction: 'any', step: 1, min: 0, prompt: 'What did you spend today?' },
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['finance', 'tracking'],
    guidance: {
      summary: 'People consistently underestimate spending by a third until they write it down.'
    }
  }),
  habit('budget-review', 'Weekly budget review', '📊', 'Fifteen minutes, once a week.', {
    points: 15,
    goal: 15,
    unit: 'minutes',
    tags: ['finance', 'review']
  }),
  habit('save-transfer', 'Move money to savings', '🏦', 'Automate it if you can.', {
    tracking: { kind: 'currency', unit: '$', direction: 'at-least', step: 5, min: 0, prompt: 'How much did you save?' },
    points: 15,
    goal: 1,
    unit: 'transfer',
    tags: ['finance', 'saving'],
    guidance: { tips: ['Set it for payday. Saving what is left over rarely works.'] }
  }),
  habit('no-impulse-buying', 'No unplanned purchases', '🛒', 'Wait 24 hours before buying.', {
    type: 'bad',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['finance', 'avoid'],
    guidance: { summary: 'Most impulse purchases stop being appealing overnight.' }
  }),
  habit('no-eating-out', 'No eating out', '🍱', 'Bring lunch instead.', {
    type: 'bad',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['finance', 'avoid']
  }),
  habit('cancel-subscription', 'Cancel one subscription', '✂️', 'The one you forgot you had.', {
    points: 15,
    goal: 1,
    unit: 'subscription',
    tags: ['finance', 'admin']
  }),
  habit('pay-bills-on-time', 'Pay bills on time', '📮', 'Before the reminder arrives.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['finance', 'admin']
  }),
  habit('extra-debt-payment', 'Extra payment toward debt', '💳', 'Anything above the minimum.', {
    points: 20,
    goal: 1,
    unit: 'payment',
    tags: ['finance', 'debt']
  }),
  habit('learn-investing', 'Learn about money', '📈', 'Read or study for fifteen minutes.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['finance', 'learning']
  }),
  habit('no-buy-day', 'No-spend day', '🚫', 'Nothing bought at all.', {
    type: 'bad',
    difficulty: 'hard',
    points: 15,
    goal: 1,
    unit: 'day',
    tags: ['finance', 'avoid']
  })
]);

const home = group(CAT, 'home', [
  habit('make-bed', 'Make the bed', '🛏️', 'A finished task before the day starts.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['home', 'morning']
  }),
  habit('tidy-15', '15-minute tidy', '🧹', 'A timer and one room.', {
    difficulty: 'easy',
    points: 10,
    goal: 15,
    unit: 'minutes',
    tags: ['home', 'cleaning']
  }),
  habit('dishes-before-bed', 'Kitchen clear before bed', '🍽️', 'Wake up to a clean start.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['home', 'cleaning']
  }),
  habit('declutter-one-thing', 'Remove one thing', '📦', 'Sell, donate or bin it.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'item',
    tags: ['home', 'decluttering']
  }),
  habit('laundry', 'Stay on top of laundry', '🧺', 'Washed, dried and put away.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'load',
    tags: ['home', 'cleaning']
  }),
  habit('water-plants', 'Tend a plant', '🪴', 'Small, calming, and alive.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['home']
  }),
  habit('gardening', 'Time in the garden', '🌱', 'Planting, weeding, pruning or just watching.', {
    difficulty: 'easy',
    points: 10,
    goal: 30,
    unit: 'minutes',
    tags: ['home', 'outdoors']
  }),
  habit('car-maintenance', 'Car maintenance', '🔧', 'Checks, fluids, tyres — before something fails.', {
    points: 10,
    goal: 1,
    unit: 'job',
    tags: ['home', 'maintenance']
  }),
  habit('hosting-practice', 'Host someone', '🍽️', 'Cook for people and sit down with them.', {
    points: 15,
    goal: 1,
    unit: 'time',
    tags: ['home', 'social']
  }),
  habit('home-maintenance', 'One maintenance job', '🔧', 'The small thing that becomes a big thing.', {
    points: 15,
    goal: 1,
    unit: 'job',
    tags: ['home', 'maintenance']
  }),
  habit('inbox-paper', 'Deal with the post', '📬', 'Open it the day it arrives.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['home', 'admin']
  }),
  habit('prep-tomorrow', 'Set out tomorrow\'s things', '🎒', 'Clothes, bag, keys.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['home', 'evening']
  })
]);

const planet = group(CAT, 'planet', [
  habit('walk-or-cycle', 'Walk or cycle instead of driving', '🚲', 'For trips under two miles.', {
    points: 10,
    goal: 1,
    unit: 'trip',
    tags: ['environment', 'cardio']
  }),
  habit('no-single-use-plastic', 'No single-use plastic', '♻️', 'Carry a bottle and a bag.', {
    type: 'bad',
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['environment', 'avoid']
  }),
  habit('recycle-properly', 'Sort the recycling', '🗑️', 'Properly, not hopefully.', {
    difficulty: 'easy',
    points: 5,
    goal: 1,
    unit: 'day',
    tags: ['environment']
  }),
  habit('no-food-waste', 'Waste no food', '🥡', 'Eat what you bought.', {
    points: 10,
    goal: 1,
    unit: 'day',
    tags: ['environment', 'finance']
  }),
  habit('public-transport', 'Take public transport', '🚌', 'Leave the car at home.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'trip',
    tags: ['environment']
  }),
  habit('buy-secondhand', 'Buy it secondhand', '🏷️', 'Before buying new.', {
    difficulty: 'easy',
    points: 10,
    goal: 1,
    unit: 'purchase',
    tags: ['environment', 'finance']
  })
]);

export const LIFE: LibrarySection = {
  category: {
    id: CAT,
    name: 'Life & Relationships',
    icon: '💬',
    description: 'People, money, home and the world around you.',
    accent: 'from-pink-400 to-rose-600',
    subcategories: [
      sub('relationships', 'Relationships', '❤️', 'Family, friends and partners.'),
      sub('community', 'Community & giving', '🤲', 'Volunteering, kindness and showing up.'),
      sub('money', 'Money', '💰', 'Tracking, saving, spending and debt.'),
      sub('home', 'Home', '🏠', 'Cleaning, admin and maintenance.'),
      sub('planet', 'Planet', '🌱', 'Small daily choices that add up.')
    ]
  },
  habits: [...relationships, ...community, ...money, ...home, ...planet]
};
