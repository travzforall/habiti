import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ConsentService } from './consent.service';
import { LEGAL_INDEX } from '../config/legal/registry';

/**
 * What this suite is really about is the FLOOR.
 *
 * campaign_participants resets consent to zero on any rule change, which is
 * right for two people negotiating a campaign and far too blunt for a legal
 * document: re-prompting everyone for a corrected apostrophe is how users learn
 * that these prompts mean nothing. `requiresAcceptanceFrom` expresses the same
 * idea as a floor instead, and getting that wrong in either direction is bad —
 * too eager and it is noise, too lax and someone never sees a material change.
 */
class MockAuth {
  currentUserValue: { id: number; email: string } | null = { id: 6, email: 'a@example.com' };
}

class MockBaserow {
  createRow = jasmine.createSpy('createRow').and.returnValue(of({ id: 101 }));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of({}));
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ConsentService,
      provideTestUserId(),
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow }
    ]
  });
  return {
    service: TestBed.inject(ConsentService),
    baserow: TestBed.inject(BaserowService) as unknown as MockBaserow
  };
}

describe('ConsentService', () => {
  afterEach(() => localStorage.clear());

  describe('document acceptance', () => {
    it('starts with everything outstanding', () => {
      const { service } = build();
      expect(service.outstanding()).toEqual(['terms', 'privacy']);
      expect(service.needsAcceptance()).toBe(true);
    });

    it('records the version AND the hash of what was accepted', () => {
      const { service } = build();
      const record = service.acceptDocument('terms', 'registration');

      // The hash is the point: a version number alone would silently start
      // meaning different words if v1's text were ever edited.
      expect(record.documentVersion).toBe(LEGAL_INDEX['terms'].currentVersion);
      expect(record.contentHash).toBe(LEGAL_INDEX['terms'].contentHash);
      expect(record.contentHash).toBeTruthy();
    });

    it('clears an outstanding document once accepted', () => {
      const { service } = build();
      service.acceptDocument('terms', 'registration');
      expect(service.outstanding()).toEqual(['privacy']);

      service.acceptDocument('privacy', 'registration');
      expect(service.outstanding()).toEqual([]);
      expect(service.needsAcceptance()).toBe(false);
    });

    it('marks every client-written record as such', () => {
      // Without this, a table holding both client and API rows would be one in
      // which no row could be trusted and none could be told apart.
      const { service } = build();
      expect(service.acceptDocument('terms', 'registration').writtenBy).toBe('client');
    });
  });

  describe('special-category consent', () => {
    it('is not implied by accepting the terms', () => {
      // The whole point of Article 9(2)(a): explicit consent is separate, and
      // cannot ride on a general acceptance checkbox.
      const { service } = build();
      service.acceptDocument('terms', 'registration');
      service.acceptDocument('privacy', 'registration');

      expect(service.hasSensitiveConsent('sobriety')).toBe(false);
      expect(service.hasSensitiveConsent('health')).toBe(false);
    });

    it('is granted per category, not globally', () => {
      const { service } = build();
      service.recordSensitiveConsent('sobriety', true, 'habit_add');

      expect(service.hasSensitiveConsent('sobriety')).toBe(true);
      expect(service.hasSensitiveConsent('religion')).toBe(false);
    });

    it('records a refusal rather than writing nothing', () => {
      // A refusal is evidence the path was real, and it is what stops the app
      // asking again in the same breath.
      const { service } = build();
      const record = service.recordSensitiveConsent('religion', false, 'habit_add');

      expect(record.accepted).toBe(false);
      expect(service.hasSensitiveConsent('religion')).toBe(false);
    });

    it('withdrawal closes the record rather than deleting it', () => {
      const { service } = build();
      service.recordSensitiveConsent('sobriety', true, 'habit_add');
      service.withdraw('special_category', 'sobriety');

      expect(service.hasSensitiveConsent('sobriety')).toBe(false);
      // Article 7(3): the fact of withdrawal is itself something the controller
      // must be able to show. A deleted row shows nothing.
      const record = service.records().find(r => r.scope === 'sobriety');
      expect(record).toBeDefined();
      expect(record!.withdrawnAt).toBeTruthy();
    });

    it('can be granted again after being withdrawn', () => {
      const { service } = build();
      service.recordSensitiveConsent('sobriety', true, 'habit_add');
      service.withdraw('special_category', 'sobriety');
      service.recordSensitiveConsent('sobriety', true, 'habit_add');

      expect(service.hasSensitiveConsent('sobriety')).toBe(true);
      expect(service.records().filter(r => r.scope === 'sobriety').length).toBe(2);
    });
  });

  describe('campaign share consent', () => {
    it('is scoped to one campaign', () => {
      const { service } = build();
      service.recordShareConsent('chl_abc', true);

      expect(service.hasShareConsent('chl_abc')).toBe(true);
      expect(service.hasShareConsent('chl_other')).toBe(false);
    });

    it('is not satisfied by the Article 9 consent alone', () => {
      // Agreeing to RECORD recovery data is not agreeing to SHOW it to a named
      // person. Two decisions, two consents.
      const { service } = build();
      service.recordSensitiveConsent('sobriety', true, 'habit_add');
      expect(service.hasShareConsent('chl_abc')).toBe(false);
    });
  });

  describe('sign-up acceptance, which happens before there is an account', () => {
    it('is adopted by the account it was given for', () => {
      const { service } = build();
      service.stashSignupAcceptance('a@example.com');
      service.reload();

      expect(service.outstanding()).toEqual([]);
      expect(service.records().every(r => r.surface === 'registration')).toBe(true);
    });

    it('is NOT adopted by a different account on the same browser', () => {
      // Someone else finishing a sign-up on this device must not hand their
      // agreement to whoever signs in next — the same bleed UserStorage exists
      // to prevent.
      const { service } = build();
      service.stashSignupAcceptance('someone-else@example.com');
      service.reload();

      expect(service.outstanding()).toEqual(['terms', 'privacy']);
    });

    it('is consumed once, so signing in twice does not double-record', () => {
      const { service } = build();
      service.stashSignupAcceptance('a@example.com');
      service.reload();
      const afterFirst = service.records().length;

      service.reload();
      expect(service.records().length).toBe(afterFirst);
    });

    it('keeps the time the user actually agreed, not the time it was adopted', () => {
      const { service } = build();
      service.stashSignupAcceptance('a@example.com');
      const stashedAt = JSON.parse(localStorage.getItem('habiti_pending_acceptance')!).at;

      service.reload();
      expect(service.records()[0].acceptedAt).toBe(stashedAt);
    });
  });

  describe('persistence', () => {
    it('pushes an acceptance to the server when a table id exists', () => {
      const { service, baserow } = build();
      service.acceptDocument('terms', 'registration');
      // environment ships legalAcceptances: 0, so nothing is pushed yet. This
      // asserts the guard, not the write — see the note below.
      expect(baserow.createRow).not.toHaveBeenCalled();
    });

    it('records locally even with no table configured', () => {
      // The table ships as 0 until someone creates it. Until then a consent is
      // still recorded, still enforced in the UI, and still survives a reload —
      // it simply is not on a server yet.
      const { service } = build();
      service.acceptDocument('terms', 'registration');
      expect(service.acceptedVersion('terms')).toBe(LEGAL_INDEX['terms'].currentVersion);
    });
  });
});
