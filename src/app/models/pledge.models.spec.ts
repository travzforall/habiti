import {
  ChallengePledge,
  PLEDGE_KIND_META,
  SettlementRow,
  describePledge,
  owesSettlement,
  toSettlement
} from './pledge.models';

function pledge(over: Partial<ChallengePledge> = {}): ChallengePledge {
  return {
    kind: 'charity_donation',
    amount: 100,
    currency: 'USD',
    beneficiary: 'iluv_foundation_project_africa',
    disclaimerAccepted: true,
    ...over
  };
}

describe('the no-money invariant', () => {
  it('has no payment fields anywhere on a pledge', () => {
    // If this fails someone has added a payment field. Read the note at the
    // top of pledge.models.ts before changing it.
    const keys = Object.keys(pledge());
    const banned = ['token', 'card', 'paymentMethod', 'account', 'balance', 'charge', 'stripe'];
    for (const key of keys) {
      for (const word of banned) {
        expect(key.toLowerCase()).withContext(`pledge field '${key}'`).not.toContain(word);
      }
    }
  });

  it('has no payment fields on a settlement', () => {
    const settlement = toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1' } as SettlementRow);
    const banned = ['token', 'card', 'paymentmethod', 'account', 'balance', 'charge', 'stripe'];
    for (const key of Object.keys(settlement)) {
      for (const word of banned) {
        expect(key.toLowerCase()).withContext(`settlement field '${key}'`).not.toContain(word);
      }
    }
  });
});

describe('owesSettlement', () => {
  it('is owed only when the run was actually failed', () => {
    expect(owesSettlement(pledge(), 'failure')).toBe(true);
    expect(owesSettlement(pledge(), 'success')).toBe(false);
    expect(owesSettlement(pledge(), 'pending')).toBe(false);
    expect(owesSettlement(pledge(), 'void')).toBe(false);
  });

  it('is never owed without a stake', () => {
    expect(owesSettlement(undefined, 'failure')).toBe(false);
    expect(owesSettlement(pledge({ kind: 'none' }), 'failure')).toBe(false);
  });
});

describe('describePledge', () => {
  it('says nothing was staked when nothing was', () => {
    expect(describePledge(undefined)).toBe('Nothing staked');
    expect(describePledge(pledge({ kind: 'none' }))).toBe('Nothing staked');
  });

  it('names the amount and destination for a donation', () => {
    const text = describePledge(pledge());
    expect(text).toContain('100');
    expect(text).toContain('charity');
  });

  it('names the partner for a peer prize', () => {
    expect(describePledge(pledge({ kind: 'peer_prize' }))).toContain('partner');
  });

  it('uses the user\'s own words for a forfeit', () => {
    const text = describePledge(
      pledge({ kind: 'non_monetary', amount: undefined, description: 'cook dinner for a month' })
    );
    expect(text).toBe('cook dinner for a month');
  });

  it('still reads sensibly when a money pledge has no amount', () => {
    expect(describePledge(pledge({ amount: undefined }))).toContain('charity');
  });
});

describe('toSettlement', () => {
  it('unwraps a Baserow single-select and defaults to due', () => {
    expect(
      toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1', settlement_status: { value: 'waived' } } as SettlementRow).status
    ).toBe('waived');
    expect(
      toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1', settlement_status: 'nonsense' } as SettlementRow).status
    ).toBe('due');
    expect(
      toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1' } as SettlementRow).status
    ).toBe('due');
  });

  it('infers charity vs peer from whether there is a creditor', () => {
    expect(toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1' } as SettlementRow).kind)
      .toBe('charity_donation');
    expect(
      toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1', creditor_user_id: '2' } as SettlementRow).kind
    ).toBe('peer_prize');
  });

  it('defaults the currency rather than leaving it blank', () => {
    expect(toSettlement({ id: 1, campaign_key: 'k', debtor_user_id: '1' } as SettlementRow).currency).toBe('USD');
  });
});

describe('PLEDGE_KIND_META', () => {
  it('only asks for an amount where an amount makes sense', () => {
    expect(PLEDGE_KIND_META.none.hasAmount).toBe(false);
    expect(PLEDGE_KIND_META.non_monetary.hasAmount).toBe(false);
    expect(PLEDGE_KIND_META.charity_donation.hasAmount).toBe(true);
    expect(PLEDGE_KIND_META.peer_prize.hasAmount).toBe(true);
  });
});
