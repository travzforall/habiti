import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_INDEX, legalRoute } from '../../config/legal/registry';

/**
 * How Habiti is built and secured. Public.
 *
 * WRITTEN HONESTLY OR NOT AT ALL. This is the one page a security-minded reader
 * will check against reality, and a Trust page that overclaims is worse than no
 * Trust page — it converts a fixable engineering gap into a false statement.
 *
 * So it says what is true today, including the part that is not good: the
 * database credential currently ships in the app bundle, which means separation
 * between accounts is not enforced by a server. That is being fixed by moving
 * data access behind an API. Saying so costs less than being found out.
 *
 * Deliberately not a legal document in the registry — it describes a posture
 * that changes as engineering lands, rather than terms anyone agrees to, so
 * versioning and re-acceptance would be the wrong machinery.
 */
@Component({
  selector: 'app-trust',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold text-slate-900">Trust &amp; security</h1>
    <p class="mt-2 text-slate-600">
      How Habiti is built, what we are good at, and what we are still fixing.
    </p>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-slate-900">What we do not do</h2>
      <ul class="mt-3 space-y-2 text-slate-700">
        <li>• No analytics. We do not measure you.</li>
        <li>• No advertising network. The one promotional panel promotes Habiti.</li>
        <li>• No cookies at all, so there is no cookie banner.</li>
        <li>• No selling or sharing of personal data.</li>
        <li>• No email. Habiti sends none, so there is nothing to unsubscribe from.</li>
        <li>• No tracking across other websites, and no browser fingerprinting.</li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-slate-900">Where your data lives</h2>
      <p class="mt-2 text-slate-700">
        Three suppliers, and no more: one for accounts and sign-in, one for the database, and one
        to serve the app to your browser. They are named on our
        <a [routerLink]="route('subprocessors')" class="text-blue-600 hover:underline">
          Subprocessors page</a
        >, which changes before they do.
      </p>
    </section>

    <!--
      The honest section. This is the whole reason the page exists.
    -->
    <section class="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h2 class="text-xl font-bold text-amber-900">What we are fixing</h2>
      <p class="mt-2 text-amber-900">
        Habiti currently talks to its database directly from your browser, using a shared
        credential built into the app. It works, and it is not how we want it to stay: it means
        the separation between one account and another is enforced by the app rather than by the
        server.
      </p>
      <p class="mt-3 text-amber-900">
        We are moving that behind a server that checks who is asking before it answers. Until that
        lands we are not claiming stronger protection than we have, we are not launching a growth
        push, and this paragraph stays here.
      </p>
      <p class="mt-3 text-amber-900">
        Files you attach to a task sit on the same footing, and one detail is worth stating on its
        own: an attachment is stored at a long, random web address that is
        <strong>not password-protected</strong>. Nobody will find it by guessing or by searching,
        but anyone you send the link to can open it without signing in. Removing an attachment
        takes it off the task and deletes our record of it; we cannot yet erase the stored copy,
        so its address keeps working. Both are fixed by the same move to a server that checks who
        is asking.
      </p>
      <p class="mt-3 text-sm text-amber-800">
        If that matters to you — and for recovery, therapy or medication habits, or a photograph
        of a letter about any of them, it reasonably might — it is a good reason to wait before
        putting those here.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-slate-900">Sensitive habits</h2>
      <p class="mt-2 text-slate-700">
        Some habits reveal health, recovery or belief. We ask separately before storing any of
        them, and separately again before showing them to another person in a shared challenge.
        You can withdraw either in Settings, and we offer to delete what it covered.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-slate-900">Insurance</h2>
      <p class="mt-2 text-slate-700">
        Our
        <a [routerLink]="route('terms')" class="text-blue-600 hover:underline">Terms of Service</a>
        set out the limits of our liability.
      </p>
      <!--
        Cyber liability cover is a policy that has to be BOUND before it can be
        mentioned. Stating it before then would be a false statement in the one
        place a buyer checks, and an undisclosed known vulnerability is also
        exactly what voids a claim — so the token issue above goes to the broker
        too. A certificate is shared on request; a policy number never appears
        on a public page.
      -->
      <p class="mt-2 text-sm text-slate-500">
        We will state our cyber liability cover here once it is in place, and share a certificate
        on request. We would rather leave this blank than claim cover we have not bound.
      </p>
    </section>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-slate-900">Reporting a problem</h2>
      <p class="mt-2 text-slate-700">
        If you find a security issue, please tell us before telling anyone else, and give us a
        reasonable chance to fix it. We will not pursue anyone who reports in good faith.
      </p>
      <p class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        A monitored security contact address goes here before this page is published.
      </p>
    </section>

    <p class="mt-10 text-sm text-slate-500">
      Our <a [routerLink]="route('privacy')" class="text-blue-600 hover:underline">Privacy Policy</a>
      is the formal version of most of this.
      @if (index['privacy'].status === 'draft') {
        It is still a draft awaiting legal review.
      }
    </p>
  `
})
export class TrustPage {
  protected readonly index = LEGAL_INDEX;
  protected readonly route = legalRoute;
}
