import {
  StatusInputs,
  dayProgressTier,
  deriveStatus,
  isWithinSleepWindow,
  statusToRiveIndex,
  streakTier,
  timeOfDay
} from './status-derivation.util';

/** Local-time date helper — the derivation reads local hours, not UTC. */
function at(hour: number): Date {
  const d = new Date(2026, 7, 7);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function inputs(overrides: Partial<StatusInputs> = {}): StatusInputs {
  return {
    completedToday: 0,
    totalToday: 5,
    overallProgress: 50,
    dailyStreak: 0,
    campaignAttention: 0,
    focusSessionActive: false,
    celebrating: false,
    sleepWindow: { startHour: 22, endHour: 6 },
    now: at(14),
    ...overrides
  };
}

describe('streakTier', () => {
  it('maps counts onto tiers at the shared milestones', () => {
    expect(streakTier(0)).toBe('none');
    expect(streakTier(2)).toBe('none');
    expect(streakTier(3)).toBe('starting');
    expect(streakTier(7)).toBe('building');
    expect(streakTier(14)).toBe('strong');
    expect(streakTier(30)).toBe('legendary');
    expect(streakTier(365)).toBe('legendary');
  });
});

describe('dayProgressTier', () => {
  it('returns none when nothing is tracked, avoiding a divide by zero', () => {
    expect(dayProgressTier(0, 0)).toBe('none');
    expect(dayProgressTier(3, 0)).toBe('none');
  });

  it('buckets the completion ratio', () => {
    expect(dayProgressTier(0, 5)).toBe('none');
    expect(dayProgressTier(1, 5)).toBe('low');
    expect(dayProgressTier(2, 5)).toBe('partial');
    expect(dayProgressTier(4, 5)).toBe('most');
    expect(dayProgressTier(5, 5)).toBe('complete');
  });
});

describe('timeOfDay', () => {
  it('splits the day at 5/12/17/22', () => {
    expect(timeOfDay(at(2))).toBe('night');
    expect(timeOfDay(at(8))).toBe('morning');
    expect(timeOfDay(at(14))).toBe('afternoon');
    expect(timeOfDay(at(19))).toBe('evening');
    expect(timeOfDay(at(23))).toBe('night');
  });
});

describe('isWithinSleepWindow', () => {
  it('handles a window that wraps past midnight', () => {
    expect(isWithinSleepWindow(22, 6, at(23))).toBe(true);
    expect(isWithinSleepWindow(22, 6, at(3))).toBe(true);
    expect(isWithinSleepWindow(22, 6, at(6))).toBe(false);
    expect(isWithinSleepWindow(22, 6, at(14))).toBe(false);
  });

  it('handles a same-day window', () => {
    expect(isWithinSleepWindow(1, 9, at(5))).toBe(true);
    expect(isWithinSleepWindow(1, 9, at(9))).toBe(false);
    expect(isWithinSleepWindow(1, 9, at(23))).toBe(false);
  });

  it('treats an empty window as never sleeping', () => {
    expect(isWithinSleepWindow(8, 8, at(8))).toBe(false);
  });
});

describe('deriveStatus precedence', () => {
  it('celebrating outranks everything', () => {
    const result = deriveStatus(
      inputs({ celebrating: true, now: at(23), campaignAttention: 3, completedToday: 0 })
    );
    expect(result.status).toBe('celebrating');
  });

  it('sleeping outranks campaign pressure', () => {
    const result = deriveStatus(inputs({ now: at(23), campaignAttention: 2 }));
    expect(result.status).toBe('sleeping');
    expect(result.intensity).toBeLessThan(0.3);
  });

  it('focus outranks campaign pressure', () => {
    const result = deriveStatus(inputs({ focusSessionActive: true, campaignAttention: 2 }));
    expect(result.status).toBe('focused');
  });

  it('an overdue campaign outranks a good day', () => {
    const result = deriveStatus(
      inputs({ campaignAttention: 1, completedToday: 5, totalToday: 5, dailyStreak: 20 })
    );
    expect(result.status).toBe('atRisk');
    expect(result.reason).toContain('1 campaign');
  });

  it('pluralises the campaign reason', () => {
    expect(deriveStatus(inputs({ campaignAttention: 3 })).reason).toContain('3 campaigns');
  });
});

describe('deriveStatus outcomes', () => {
  it('is idle with no habits tracked', () => {
    expect(deriveStatus(inputs({ totalToday: 0 })).status).toBe('idle');
  });

  it('thrives on a fully completed day', () => {
    const result = deriveStatus(inputs({ completedToday: 5, totalToday: 5 }));
    expect(result.status).toBe('thriving');
    expect(result.intensity).toBe(1);
  });

  it('thrives on most-done plus a streak, but not on most-done alone', () => {
    expect(deriveStatus(inputs({ completedToday: 4, totalToday: 5, dailyStreak: 7 })).status).toBe(
      'thriving'
    );
    expect(deriveStatus(inputs({ completedToday: 4, totalToday: 5, dailyStreak: 0 })).status).toBe(
      'onTrack'
    );
  });

  it('only calls it struggling late in the day', () => {
    // Same numbers, different hour — morning gets the benefit of the doubt.
    expect(deriveStatus(inputs({ completedToday: 0, now: at(9), overallProgress: 60 })).status).toBe(
      'onTrack'
    );
    expect(deriveStatus(inputs({ completedToday: 0, now: at(20) })).status).toBe('struggling');
  });

  it('mentions the day count in the reason', () => {
    expect(deriveStatus(inputs({ completedToday: 3, totalToday: 5 })).reason).toContain(
      '3 of 5 habits'
    );
  });
});

describe('statusToRiveIndex', () => {
  it('is stable and starts idle at 0', () => {
    expect(statusToRiveIndex('idle')).toBe(0);
    expect(statusToRiveIndex('sleeping')).toBe(1);
    expect(statusToRiveIndex('celebrating')).toBe(7);
  });

  it('falls back to 0 for an unknown status', () => {
    expect(statusToRiveIndex('nonsense' as never)).toBe(0);
  });
});
