/**
 * Reading what a shop's product link will tell you.
 *
 * ── WHY THIS DOES NOT FETCH THE PAGE ──────────────────────────────────────
 *
 * A real import would load the Home Depot page and read its title and price.
 * The browser cannot: no shop sends the CORS headers that would allow it, and
 * Habiti has no server to fetch it from. Adding one would mean routing every
 * product someone looks at through a machine of ours — a log of what a person
 * is buying, kept somewhere, to save them typing a price.
 *
 * So this reads what is already IN the address, which is more than it sounds:
 * retailers put the product name in the path, and the SKU after it. A Home
 * Depot link gives back "Dewalt 12 in Double Bevel Sliding Compound Mitre Saw"
 * and its item number without a single request.
 *
 * What it cannot know is the PRICE, and it says so rather than inventing one.
 * The person confirms two fields instead of typing five, and the honest split
 * is that the machine does the tedious part and the human does the part only
 * they can see.
 */

export interface RecognisedProduct {
  /** The shop, when it is one we know. */
  retailer?: string;
  /** The product name read out of the path. Undefined when the path says nothing. */
  title?: string;
  /** The shop's own code for it, when the address carries one. */
  sku?: string;
  /** The address itself, tidied. */
  url: string;
  /**
   * What still has to be filled in by hand. Always includes the price — no
   * address contains one, and pretending otherwise is how a budget quietly
   * becomes fiction.
   */
  missing: string[];
}

interface RetailerRule {
  name: string;
  hosts: string[];
  /** Pulls the product name out of the path. */
  title?: (path: string) => string | undefined;
  sku?: (path: string, url: URL) => string | undefined;
}

/** Turns "DEWALT-12-in-Sliding-Mitre-Saw" into "Dewalt 12 in sliding mitre saw". */
function fromSlug(slug: string | undefined): string | undefined {
  if (!slug) return undefined;

  const words = decodeURIComponent(slug)
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(part => part.length > 0 && !/^\d{6,}$/.test(part));

  if (words.length === 0) return undefined;

  const sentence = words.join(' ').toLowerCase().trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const RETAILERS: RetailerRule[] = [
  {
    name: 'The Home Depot',
    hosts: ['homedepot.com', 'homedepot.ca'],
    // /p/<slug>/<sku>
    title: path => fromSlug(path.split('/p/')[1]?.split('/')[0]),
    sku: path => path.split('/p/')[1]?.split('/')[1]?.replace(/\D/g, '') || undefined
  },
  {
    name: "Lowe's",
    hosts: ['lowes.com'],
    // /pd/<slug>/<sku>
    title: path => fromSlug(path.split('/pd/')[1]?.split('/')[0]),
    sku: path => path.split('/pd/')[1]?.split('/')[1]?.replace(/\D/g, '') || undefined
  },
  {
    name: 'B&Q',
    hosts: ['diy.com'],
    title: path => fromSlug(path.split('/departments/')[1]?.split('/').pop()?.replace(/_.*$/, '')),
    sku: (_path, url) => url.pathname.match(/_(\d{6,})\.prd/)?.[1]
  },
  {
    name: 'Screwfix',
    hosts: ['screwfix.com'],
    // /p/<slug>/<code>
    title: path => fromSlug(path.split('/p/')[1]?.split('/')[0]),
    sku: path => path.split('/p/')[1]?.split('/')[1]?.toUpperCase() || undefined
  },
  {
    name: 'Toolstation',
    hosts: ['toolstation.com'],
    title: path => fromSlug(path.split('/').filter(Boolean).pop()?.replace(/\/p\d+$/, '')),
    sku: path => path.match(/\/p(\d{4,})$/)?.[1]
  },
  {
    name: 'Wickes',
    hosts: ['wickes.co.uk'],
    title: path => fromSlug(path.split('/product/')[1]?.split('/')[0]),
    sku: (_path, url) => url.pathname.match(/\/p\/(\d+)/)?.[1]
  },
  {
    name: 'Amazon',
    hosts: ['amazon.com', 'amazon.co.uk', 'amazon.ca'],
    // /<slug>/dp/<asin>
    title: path => fromSlug(path.split('/dp/')[0]?.split('/').filter(Boolean).pop()),
    sku: path => path.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase()
  },
  {
    name: 'Toolstop',
    hosts: ['toolstop.co.uk'],
    title: path => fromSlug(path.split('/').filter(Boolean).pop()),
    sku: undefined
  }
];

/**
 * Reads a pasted product address.
 *
 * Returns undefined only when the text is not a web address at all — an unknown
 * shop still gets a result, because the last part of almost any product path is
 * the product's name, and a link worth keeping is worth keeping even when we
 * cannot name the shop.
 */
export function readProductLink(raw: string): RecognisedProduct | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  let url: URL;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  if (!url.hostname.includes('.')) return undefined;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const rule = RETAILERS.find(candidate => candidate.hosts.some(h => host === h || host.endsWith(`.${h}`)));
  const path = url.pathname;

  const title = rule?.title?.(path) ?? fallbackTitle(path);
  const sku = rule?.sku?.(path, url);

  const missing = ['price'];
  if (!title) missing.push('name');

  return {
    retailer: rule?.name,
    title,
    sku,
    // Tracking parameters are most of a shop link and none of its meaning.
    url: `${url.origin}${url.pathname}`,
    missing
  };
}

/** The last meaningful part of a path, for a shop we have no rule for. */
function fallbackTitle(path: string): string | undefined {
  const parts = path.split('/').filter(part => part.length > 0);

  for (const part of [...parts].reverse()) {
    // Skip pure ids and file extensions: they are not names.
    if (/^\d+$/.test(part)) continue;
    const cleaned = part.replace(/\.(html?|php|aspx)$/i, '');
    const title = fromSlug(cleaned);
    if (title && title.length > 2) return title;
  }

  return undefined;
}
