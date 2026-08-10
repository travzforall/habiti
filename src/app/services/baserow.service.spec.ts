import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BaserowService } from './baserow.service';

/**
 * These tests exist because of a real, silent data leak.
 *
 * The query was built as `filter__field_<name>__<op>`. That prefix is only
 * valid for NUMERIC field ids, and Baserow IGNORES a filter parameter it does
 * not recognise instead of rejecting it — so every "filtered" read quietly
 * returned the entire table and each user saw the first row, whoever owned it.
 *
 * Nothing failed. No error, no warning, correct-looking data on screen. The
 * only way to catch a regression here is to assert the URL itself.
 */
describe('BaserowService URL building', () => {
  let service: BaserowService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BaserowService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BaserowService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Grabs the single outstanding request's URL. */
  function urlOf(predicate: (url: string) => boolean): string {
    const [req] = http.match(r => predicate(r.urlWithParams));
    expect(req).withContext('expected exactly one matching request').toBeTruthy();
    req.flush({ count: 0, next: null, previous: null, results: [] });
    return req.request.urlWithParams;
  }

  it('names the field directly — never the field_ prefix', () => {
    service.listRows(521, { filters: [{ field: 'user_id', op: 'equal', value: '6' }] }).subscribe();

    const url = urlOf(u => u.includes('521'));
    expect(url).toContain('filter__user_id__equal=6');
    // The regression itself.
    expect(url).not.toContain('filter__field_user_id');
  });

  it('always asks for field names, since the filters depend on them', () => {
    service.listRows(521, { filters: [{ field: 'user_id', op: 'equal', value: '6' }] }).subscribe();
    expect(urlOf(u => u.includes('521'))).toContain('user_field_names=true');
  });

  it('carries every filter, not just the first', () => {
    service
      .listRows(522, {
        filters: [
          { field: 'user_id', op: 'equal', value: '6' },
          { field: 'date', op: 'date_after', value: '2026-01-01' }
        ]
      })
      .subscribe();

    const url = urlOf(u => u.includes('522'));
    expect(url).toContain('filter__user_id__equal=6');
    expect(url).toContain('filter__date__date_after=2026-01-01');
  });

  it('encodes values so a stray & cannot inject a parameter', () => {
    service
      .listRows(620, { filters: [{ field: 'addressee_email', op: 'equal', value: 'a+b@x.com' }] })
      .subscribe();

    const url = urlOf(u => u.includes('620'));
    expect(url).toContain('filter__addressee_email__equal=a%2Bb%40x.com');
  });

  it('passes filter_type through for OR queries', () => {
    service
      .listRows(620, {
        filterType: 'OR',
        filters: [{ field: 'requester_user_id', op: 'equal', value: '6' }]
      })
      .subscribe();

    expect(urlOf(u => u.includes('620'))).toContain('filter_type=OR');
  });

  it('sends no filter parameter when there are no filters', () => {
    service.listRows(521).subscribe();
    expect(urlOf(u => u.includes('521'))).not.toContain('filter__');
  });

  it('scopes the habits read to one user', () => {
    service.getHabits('6', true).subscribe();

    const url = urlOf(u => u.includes('521'));
    expect(url).toContain('filter__user_id__equal=6');
    expect(url).toContain('filter__is_active__equal=true');
    expect(url).not.toContain('filter__field_');
  });

  it('scopes the entries read to one user and date range', () => {
    service.getHabitEntries(undefined, '6', '2026-01-01', '2026-02-01').subscribe();

    const url = urlOf(u => u.includes('522'));
    expect(url).toContain('filter__user_id__equal=6');
    expect(url).toContain('filter__date__date_after=2026-01-01');
    expect(url).toContain('filter__date__date_before=2026-02-01');
  });

  it('scopes the game state read to one user', () => {
    service.getGameState('6').subscribe();

    const url = urlOf(u => u.includes('524'));
    expect(url).toContain('filter__user_id__equal=6');
    expect(url).not.toContain('filter__field_');
  });

  it('never filters a link_row field, which Baserow rejects outright', () => {
    // habit_id and category_id are link_row: `equal` and `contains` both 400.
    // Sending one would turn a silent over-fetch into a hard failure.
    service.getHabitEntries(7, '6').subscribe();
    expect(urlOf(u => u.includes('522'))).not.toContain('habit_id');

    service.getHabitSubcategories(3).subscribe();
    expect(urlOf(u => u.includes('518'))).not.toContain('category_id');
  });
});
