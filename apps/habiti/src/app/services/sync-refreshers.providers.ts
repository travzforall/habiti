import { EnvironmentProviders, Provider, inject, makeEnvironmentProviders } from '@angular/core';
import { ChallengeService } from './challenge.service';
import { ConsentService } from './consent.service';
import { DailyContentService } from './daily-content.service';
import { FriendsService } from './friends.service';
import { HabitsService } from './habits';
import { LevelService } from './level.service';
import { NotificationsService } from './notifications.service';
import { ProjectsService } from './projects.service';
import { ResettableRegistry } from './resettable.registry';
import { SkillsService } from './skills.service';
import { SYNC_REFRESHERS, SyncRefresher } from '@habiti/sync';
import { TasksService } from './tasks.service';

/**
 * Where the scheduler meets the features.
 *
 * This is the ONLY file that imports both SyncService's world and every domain
 * service, which is the entire point: sync-refresher.ts and sync.service.ts
 * name no feature, so they can move into a shared library while this stays
 * behind with the app that happens to have these particular domains.
 *
 * REGISTRATION ORDER IS BEHAVIOUR, in one respect: reset() runs the refreshers
 * in order, and the locally-cached domains (tasks, projects, skills) are
 * re-read before the server-backed ones are cleared. That is the order the
 * hand-written reset() used.
 */
function refresher(factory: () => SyncRefresher): Provider {
  return { provide: SYNC_REFRESHERS, useFactory: factory, multi: true };
}

export function provideSyncRefreshers(): EnvironmentProviders {
  return makeEnvironmentProviders([
    // --- locally cached, server-backed: reload() re-reads this account's rows
    refresher(() => {
      const tasks = inject(TasksService);
      return { scopes: ['tasks'], refresh: () => tasks.reload(), reset: () => tasks.reload() };
    }),
    refresher(() => {
      const projects = inject(ProjectsService);
      return {
        scopes: ['projects'],
        refresh: () => projects.reload(),
        reset: () => projects.reload()
      };
    }),
    refresher(() => {
      const skills = inject(SkillsService);
      return { scopes: ['skills'], refresh: () => skills.reload(), reset: () => skills.reload() };
    }),
    /**
     * Everything lazy, in one line.
     *
     * Checklists, attachments, inspiration boards and mind maps all need
     * clearing when the account changes, and none of them should be in the
     * initial bundle to get it. They register themselves with the registry when
     * their chunk loads; this refresher is the only eager thing that knows they
     * exist. See resettable.registry.ts.
     *
     * The scope list is what those members MAY ask for — the registry only
     * refreshes the ones that asked for a scope in this pass.
     */
    refresher(() => {
      const registry = inject(ResettableRegistry);
      return {
        scopes: ['tasks', 'projects', 'inspiration'],
        refresh: ({ scopes }) => registry.refresh(scopes),
        reset: () => registry.resetAll()
      };
    }),

    // --- server-backed
    refresher(() => {
      const friends = inject(FriendsService);
      return {
        scopes: ['friends'],
        refresh: () => friends.refresh(),
        reset: () => friends.reset(),
        hasPending: () =>
          friends.pendingOutgoing().length > 0 || friends.incomingRequests().length > 0
      };
    }),

    refresher(() => {
      const challenges = inject(ChallengeService);
      return {
        scopes: ['challenges', 'settlements'],

        /**
         * Owns two scopes because refreshing runs already reloads settlements.
         * Asking for both must not fetch settlements twice, so the wider call
         * wins and the narrow one is only used when runs were NOT requested.
         */
        refresh: ({ scopes, reconcile }) =>
          scopes.has('challenges')
            ? challenges.refreshRuns({ reconcile })
            : challenges.refreshSettlements(),

        reset: () => challenges.reset(),
        hasPending: () =>
          challenges.settlementsToConfirm().length > 0 ||
          challenges
            .activeRuns()
            .some(run => (run.participants ?? []).some(p => p.inviteStatus === 'invited')),

        // ChallengeService freezes its date at construction, so a tab left open
        // overnight computes check-in state against yesterday.
        onDayRollover: today => challenges.setToday(today)
      };
    }),

    refresher(() => {
      const levels = inject(LevelService);
      return {
        scopes: ['levels'],
        // Refreshing mid-award would fight the optimistic record. The caller's
        // next full pass picks it up.
        canRun: () => !levels.hasAwardsInFlight(),
        refresh: () => levels.refresh(),
        reset: () => levels.reset()
      };
    }),

    refresher(() => {
      const habits = inject(HabitsService);
      return { scopes: ['habits'], refresh: () => habits.refresh(), reset: () => habits.reset() };
    }),

    refresher(() => {
      const dailyContent = inject(DailyContentService);
      return {
        scopes: ['dailyContent'],
        refresh: () => dailyContent.refresh(),
        reset: () => dailyContent.reset(),
        onDayRollover: () => dailyContent.refreshForToday()
      };
    }),

    /**
     * Consents: no scopes, reset only.
     *
     * Nothing pushes a hint when a consent changes — they change because the
     * user just clicked something, and the service already updated its own
     * signal. What this needs is the account switch, so the next person's
     * agreements are read rather than the previous person's left on screen.
     *
     * Registered before notifications and after the domains, because reload()
     * is also where a sign-up acceptance is adopted once there is finally a
     * user id to attach it to.
     */
    refresher(() => {
      const consent = inject(ConsentService);
      return { scopes: [], refresh: () => undefined, reset: () => consent.reload() };
    }),

    /**
     * Notifications: no scopes, reset only, and REGISTERED LAST ON PURPOSE.
     *
     * It owns no data of its own — it derives toasts from the signals the
     * refreshers above hold, and de-dupes what it has already shown. So it must
     * be cleared after them, or it re-derives from the outgoing account's state
     * and toasts the new user about the previous one's invites.
     *
     * Declaring no scopes means it never takes part in a refresh pass, which is
     * correct: SyncService deliberately does not toast, because a second toast
     * source next to this one would produce doubles.
     */
    refresher(() => {
      const notifications = inject(NotificationsService);
      return { scopes: [], refresh: () => undefined, reset: () => notifications.reset() };
    })
  ]);
}
