/** Env parsing. Fails fast rather than starting a relay that cannot verify anyone. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 8080),
  xanoApiUrl: required('XANO_API_URL').replace(/\/$/, ''),
  xanoMePath: process.env['XANO_ME_PATH'] || '/auth/me',
  /** Empty means "any origin" — only sensible for local development. */
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  tokenCacheTtlMs: num('TOKEN_CACHE_TTL_MS', 300_000),
  tokenCacheMax: num('TOKEN_CACHE_MAX', 5_000),
  heartbeatMs: num('HEARTBEAT_MS', 30_000),
  helloTimeoutMs: num('HELLO_TIMEOUT_MS', 5_000),
  maxConnections: num('MAX_CONNECTIONS', 5_000),
  maxConnectionsPerUser: num('MAX_CONNECTIONS_PER_USER', 8),
  publishRate: num('PUBLISH_RATE', 20),
  /**
   * Logs the addresses a publish was aimed at. OFF by default — those are user
   * emails and a relay log is not the place for them. Turn it on locally when
   * "delivered: 0" needs explaining.
   */
  debugAddresses: process.env['DEBUG_ADDRESSES'] === 'true'
};
