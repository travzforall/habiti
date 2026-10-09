import { InspirationKind, MediaProvider } from '../models/inspiration.models';

/**
 * Working out what a pasted address is.
 *
 * ── WHY THIS IS NOT IN inspiration.models.ts ──────────────────────────────
 *
 * InspirationService is reachable from the eager graph — sync-refreshers.ts
 * registers it so a board is cleared when the account changes — and a value
 * import from there drags whatever it touches into the initial bundle. Parsing
 * is only ever needed at the moment someone pastes something, which happens in
 * the board component, which is lazy. Keeping it here keeps roughly 3 kB out of
 * every user's first load, for the same reason config/attachment-limits.ts
 * exists.
 *
 * It is also the honest split: recognising a URL is a UI concern, and the
 * service stores what it is handed.
 */

export interface RecognisedMedia {
  kind: InspirationKind;
  provider: MediaProvider;
  sourceId?: string;
  /** Where clicking should take you. Normalised — a shorts link becomes a watch link. */
  url: string;
  thumbnailUrl?: string;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;

/**
 * YouTube ids are exactly 11 characters of `[A-Za-z0-9_-]`.
 *
 * Checking the shape matters: a URL like youtube.com/results?search_query=…
 * has no id at all, and without this it would be stored as a video whose
 * thumbnail is a permanent grey box.
 */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Works out what a pasted address is, from the URL alone.
 *
 * NO NETWORK CALL. An oEmbed lookup would give nicer titles for every provider
 * under the sun, and it would also mean the app phoning a third party the
 * instant someone pastes something — before they have even saved it. Parsing
 * the string is enough for the two providers that matter, and honest about the
 * rest.
 */
export function recogniseMedia(rawUrl: string): RecognisedMedia | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // A bare "youtube.com/..." paste has no scheme; without this it fails to parse.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // Only http(s). `javascript:` and `data:` must never reach an href.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  const youtubeId = youtubeIdFrom(host, url);
  if (youtubeId) {
    return {
      kind: 'video',
      provider: 'youtube',
      sourceId: youtubeId,
      url: `https://www.youtube.com/watch?v=${youtubeId}${startParam(url)}`,
      // hqdefault exists for every video; maxresdefault does not, and a missing
      // one renders as a broken image rather than falling back.
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) {
      // No thumbnail: Vimeo's requires an API call, and see the note above.
      return { kind: 'video', provider: 'vimeo', sourceId: id, url: `https://vimeo.com/${id}` };
    }
  }

  if (IMAGE_EXTENSIONS.test(url.pathname)) {
    return { kind: 'image', provider: 'image', url: url.toString(), thumbnailUrl: url.toString() };
  }

  return { kind: 'link', provider: 'web', url: url.toString() };
}

function youtubeIdFrom(host: string, url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return segments[0] && YOUTUBE_ID.test(segments[0]) ? segments[0] : null;
  }

  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  const v = url.searchParams.get('v');
  if (v && YOUTUBE_ID.test(v)) return v;

  // /shorts/ID, /embed/ID, /live/ID, /v/ID — all carry the id in the second segment.
  if (['shorts', 'embed', 'live', 'v'].includes(segments[0]) && segments[1]) {
    return YOUTUBE_ID.test(segments[1]) ? segments[1] : null;
  }

  return null;
}

/** Keeps a timestamp if the pasted link had one — people share the good bit. */
function startParam(url: URL): string {
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return '';
  const seconds = parseTimestamp(t);
  return seconds > 0 ? `&t=${seconds}` : '';
}

function parseTimestamp(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  // 1h2m3s, 2m30s, 45s
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/** A readable fallback title when the user does not type one. */
export function titleFrom(media: RecognisedMedia, rawUrl: string): string {
  if (media.provider === 'youtube') return 'YouTube video';
  if (media.provider === 'vimeo') return 'Vimeo video';
  try {
    const url = new URL(media.url);
    if (media.kind === 'image') {
      return decodeURIComponent(url.pathname.split('/').pop() || 'Picture');
    }
    return url.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

