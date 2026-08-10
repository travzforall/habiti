/**
 * `@habiti/realtime-protocol` — the wire contract for the hint relay.
 *
 * Pure types plus two pure functions. No Angular, no DOM, no Node globals, so
 * it is platform:agnostic and the API can publish hints using the same
 * definitions the browser validates them with.
 *
 * realtime-server/src/protocol.ts STILL HOLDS A COPY of the block between the
 * <protocol> markers. The relay is a separate npm package with its own tsc
 * build and its own node_modules, so it cannot resolve this workspace path;
 * collapsing the duplication means changing how the relay is built, which is
 * its own change. Until then check-protocol.mjs compares the two texts and
 * fails the relay's build if they drift.
 */
export * from './lib/realtime.models';
