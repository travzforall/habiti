import { recogniseMedia, titleFrom } from './media-links';
import {
  INSPIRATION_COLUMNS,
  InspirationItem,
  fromInspirationItem,
  toInspirationItem
} from '../models/inspiration.models';

/**
 * Pasting a link is the whole feature, so the parsing is where it lives or
 * dies. YouTube alone has six URL shapes in the wild, and getting one wrong
 * means a card with a permanently broken thumbnail.
 */
describe('recogniseMedia', () => {
  describe('YouTube', () => {
    const id = 'dQw4w9WgXcQ';

    it('reads a watch URL', () => {
      const media = recogniseMedia(`https://www.youtube.com/watch?v=${id}`)!;
      expect(media.kind).toBe('video');
      expect(media.provider).toBe('youtube');
      expect(media.sourceId).toBe(id);
      expect(media.thumbnailUrl).toContain(id);
    });

    it('reads a youtu.be short link', () => {
      expect(recogniseMedia(`https://youtu.be/${id}`)!.sourceId).toBe(id);
    });

    it('reads a Shorts link', () => {
      expect(recogniseMedia(`https://www.youtube.com/shorts/${id}`)!.sourceId).toBe(id);
    });

    it('reads an embed link', () => {
      expect(recogniseMedia(`https://www.youtube.com/embed/${id}`)!.sourceId).toBe(id);
    });

    it('reads a live link', () => {
      expect(recogniseMedia(`https://www.youtube.com/live/${id}`)!.sourceId).toBe(id);
    });

    it('reads a mobile link', () => {
      expect(recogniseMedia(`https://m.youtube.com/watch?v=${id}`)!.sourceId).toBe(id);
    });

    it('copes with a paste that has no scheme', () => {
      expect(recogniseMedia(`youtube.com/watch?v=${id}`)!.sourceId).toBe(id);
    });

    it('survives the tracking junk a share button adds', () => {
      const media = recogniseMedia(
        `https://www.youtube.com/watch?v=${id}&list=PL123&index=4&pp=abc`
      )!;
      expect(media.url).toBe(`https://www.youtube.com/watch?v=${id}`);
    });

    it('keeps a timestamp, because people share the good bit', () => {
      expect(recogniseMedia(`https://youtu.be/${id}?t=90`)!.url).toContain('&t=90');
      expect(recogniseMedia(`https://youtu.be/${id}?t=1m30s`)!.url).toContain('&t=90');
      expect(recogniseMedia(`https://youtu.be/${id}?t=1h1m1s`)!.url).toContain('&t=3661');
    });

    it('does not call a search page a video', () => {
      const media = recogniseMedia('https://www.youtube.com/results?search_query=habits')!;
      expect(media.kind).toBe('link');
      expect(media.provider).toBe('web');
    });

    it('rejects an id of the wrong shape rather than storing a dead thumbnail', () => {
      const media = recogniseMedia('https://youtu.be/short')!;
      expect(media.kind).toBe('link');
    });
  });

  describe('Vimeo', () => {
    it('reads a numeric id, and offers no thumbnail it cannot get', () => {
      const media = recogniseMedia('https://vimeo.com/76979871')!;
      expect(media.kind).toBe('video');
      expect(media.provider).toBe('vimeo');
      expect(media.sourceId).toBe('76979871');
      expect(media.thumbnailUrl).toBeUndefined();
    });
  });

  describe('pictures', () => {
    it('recognises an image by extension', () => {
      const media = recogniseMedia('https://example.com/photos/kitchen.JPG')!;
      expect(media.kind).toBe('image');
      expect(media.thumbnailUrl).toBe(media.url);
    });

    it('recognises one with a query string on the end', () => {
      expect(recogniseMedia('https://example.com/a.png?w=800')!.kind).toBe('image');
    });
  });

  describe('anything else', () => {
    it('is a link', () => {
      const media = recogniseMedia('https://example.com/an-article')!;
      expect(media.kind).toBe('link');
    });

    /**
     * The one that matters for safety: these must never survive to become an
     * href. Anything not http(s) is refused outright.
     */
    it('refuses a javascript: URL', () => {
      expect(recogniseMedia('javascript:alert(1)')).toBeNull();
    });

    it('refuses a data: URL', () => {
      expect(recogniseMedia('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('refuses empty input', () => {
      expect(recogniseMedia('   ')).toBeNull();
    });
  });
});

describe('titleFrom', () => {
  it('names a video by its provider', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    expect(titleFrom(recogniseMedia(url)!, url)).toBe('YouTube video');
  });

  it('names a picture by its filename', () => {
    const url = 'https://example.com/photos/kitchen%20before.jpg';
    expect(titleFrom(recogniseMedia(url)!, url)).toBe('kitchen before.jpg');
  });

  it('names a link by its host', () => {
    const url = 'https://www.example.com/an-article';
    expect(titleFrom(recogniseMedia(url)!, url)).toBe('example.com');
  });
});

describe('row mapping', () => {
  const item: InspirationItem = {
    id: '4',
    board: 'personal',
    kind: 'video',
    title: 'The one about compounding',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    provider: 'youtube',
    sourceId: 'dQw4w9WgXcQ',
    tags: ['focus'],
    sortOrder: 2,
    createdAt: new Date(2026, 7, 1)
  };

  it('writes only columns the table has', () => {
    for (const key of Object.keys(fromInspirationItem(item, '6'))) {
      expect(INSPIRATION_COLUMNS as readonly string[])
        .withContext(`writes "${key}", which inspiration_items does not have`)
        .toContain(key);
    }
  });

  it('never writes created_at, which Baserow owns', () => {
    expect(fromInspirationItem(item, '6')['created_at']).toBeUndefined();
  });

  it('round-trips', () => {
    const row = fromInspirationItem(item, '6') as never;
    const back = toInspirationItem({ ...(row as object), id: 4 } as never);

    expect(back.title).toBe(item.title);
    expect(back.kind).toBe('video');
    expect(back.sourceId).toBe('dQw4w9WgXcQ');
    expect(back.tags).toEqual(['focus']);
    expect(back.board).toBe('personal');
  });

  it('defaults a row with no board to the personal one', () => {
    expect(toInspirationItem({ id: 1, board: null as never }).board).toBe('personal');
  });
});
