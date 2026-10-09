import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { InspirationService } from './inspiration.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { recogniseMedia } from '../config/media-links';
import { PERSONAL_BOARD } from '../models/inspiration.models';

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  // 0: the table does not exist yet, which is the state the app ships in.
  tables = { inspirationItems: 0 };
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
}

class MockStorage {
  values = new Map<string, string>();
  readRaw = (key: string) => this.values.get(key) ?? null;
  writeRaw = (key: string, value: string) => void this.values.set(key, value);
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      InspirationService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });
  return TestBed.inject(InspirationService);
}

const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ';

describe('InspirationService', () => {
  it('keeps each board separate', () => {
    const service = build();
    service.addLink(PERSONAL_BOARD, recogniseMedia(YOUTUBE)!, 'YouTube video');
    service.addLink('7', recogniseMedia('https://example.com/a.jpg')!, 'a.jpg');

    expect(service.forBoard(PERSONAL_BOARD).length).toBe(1);
    expect(service.forBoard('7').length).toBe(1);
    expect(service.forBoard('7')[0].kind).toBe('image');
  });

  it('stores what a link is, so a card knows how to draw itself', () => {
    const service = build();
    const item = service.addLink(PERSONAL_BOARD, recogniseMedia(YOUTUBE)!, 'YouTube video');

    expect(item.kind).toBe('video');
    expect(item.provider).toBe('youtube');
    expect(item.sourceId).toBe('dQw4w9WgXcQ');
    expect(item.thumbnailUrl).toContain('dQw4w9WgXcQ');
  });

  it('prefers a title the user typed', () => {
    const service = build();
    const item = service.addLink(
      PERSONAL_BOARD,
      recogniseMedia(YOUTUBE)!,
      'YouTube video',
      'Watch when the streak breaks'
    );
    expect(item.title).toBe('Watch when the streak breaks');
  });

  describe('notes', () => {
    it('uses the first line as the heading, so a long note still has a short one', () => {
      const service = build();
      const item = service.addNote(PERSONAL_BOARD, 'Two weekends.\nNo more.\nSeriously.')!;

      expect(item.title).toBe('Two weekends.');
      expect(item.note).toContain('Seriously.');
      expect(item.kind).toBe('note');
    });

    it('refuses an empty one', () => {
      expect(build().addNote(PERSONAL_BOARD, '   ')).toBeNull();
    });
  });

  describe('ordering', () => {
    it('adds to the end', () => {
      const service = build();
      service.addNote(PERSONAL_BOARD, 'first');
      service.addNote(PERSONAL_BOARD, 'second');

      expect(service.forBoard(PERSONAL_BOARD).map(i => i.title)).toEqual(['first', 'second']);
    });

    it('moves an item up', () => {
      const service = build();
      service.addNote(PERSONAL_BOARD, 'first');
      const second = service.addNote(PERSONAL_BOARD, 'second')!;

      service.move(second.id, -1);
      expect(service.forBoard(PERSONAL_BOARD).map(i => i.title)).toEqual(['second', 'first']);
    });

    it('does nothing at the ends', () => {
      const service = build();
      const only = service.addNote(PERSONAL_BOARD, 'only')!;

      service.move(only.id, -1);
      service.move(only.id, 1);
      expect(service.forBoard(PERSONAL_BOARD).length).toBe(1);
    });
  });

  it('removes an item', () => {
    const service = build();
    const item = service.addNote(PERSONAL_BOARD, 'temporary')!;

    service.remove(item.id);
    expect(service.forBoard(PERSONAL_BOARD).length).toBe(0);
  });

  it('works with no table, because there is not one yet', () => {
    const service = build();
    const item = service.addNote(PERSONAL_BOARD, 'local only')!;

    // Saved, cached, and not lost — it simply does not leave this browser.
    expect(item.id).toBeTruthy();
    expect(service.forBoard(PERSONAL_BOARD).length).toBe(1);
    expect((TestBed.inject(BaserowService) as unknown as MockBaserow).createRow).not.toHaveBeenCalled();
  });
});
