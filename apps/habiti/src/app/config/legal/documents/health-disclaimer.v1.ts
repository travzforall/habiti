import { LegalDocument } from '../types';

/**
 * Health and Wellbeing notice, version 1. DRAFT.
 *
 * NOT one of the six documents originally asked for, and arguably the one this
 * app needs most. Habiti ships a `take-medication` habit ("On time, as
 * prescribed"), a `therapy-session` habit, and a thirty-day "Clean Streak"
 * sobriety challenge that it actively RECOMMENDS and that can be run with a
 * partner. Suggesting a recovery programme without saying plainly that this is
 * not treatment is the largest gap in the set.
 */
export const HEALTH_DISCLAIMER_V1: LegalDocument = {
  id: 'health-disclaimer',
  version: 1,
  effectiveFrom: '2026-08-14',
  title: 'Health and Wellbeing',
  summary: 'Habiti is a tracking tool, not treatment. Please read this one.',
  status: 'draft',
  material: true,
  changeSummary: '',
  contentHash: '7274ace2b8c94a8b3f5acf0b780bf7eae529461b6bf8057f83928ac63e0b99da',
  blocks: [
    {
      kind: 'callout',
      id: 'c-emergency',
      tone: 'warning',
      text: 'If you are in crisis or you think you may be in danger, please contact your local emergency services or a crisis line now. Habiti is not monitored, nobody is reading your entries, and it cannot get help to you.'
    },
    {
      kind: 'review',
      id: 'review-crisis-lines',
      question: 'Should we list crisis lines, and for which countries?',
      context:
        'A generic "contact emergency services" is weaker than a real number, but a wrong or dead number is worse than none, and the list has to be maintained per country. Decide with the lawyer and, ideally, someone with clinical experience.'
    },

    { kind: 'heading', id: 'h-what', text: 'What Habiti is' },
    {
      kind: 'paragraph',
      id: 'p-what',
      text: 'Habiti is a place to write down what you did and to see patterns over time. That is all it is. It is not a medical device, not a healthcare service, and not a treatment programme.'
    },

    { kind: 'heading', id: 'h-not-advice', text: 'It is not advice' },
    {
      kind: 'paragraph',
      id: 'p-not-advice',
      text: 'Nothing in Habiti is medical, psychological, psychiatric, nutritional or addiction-treatment advice. Our habit descriptions, challenge templates and suggested targets are general ideas, not a plan made for you by someone who knows your situation. Do not start, stop or change any treatment, medication or therapy because of something Habiti showed you. Talk to a qualified professional.'
    },

    { kind: 'heading', id: 'h-recovery', text: 'Recovery and sobriety' },
    {
      kind: 'paragraph',
      id: 'p-recovery',
      text: 'Habiti includes habits and challenges about staying away from alcohol or smoking, attending support groups and noticing triggers. These are here because writing things down helps some people. They are not a recovery programme, they are not supervised, and nobody at Habiti sees your entries or will notice if you stop.'
    },
    {
      kind: 'callout',
      id: 'c-recovery-partner',
      tone: 'warning',
      text: 'A shared challenge shows the other participants which days you checked in — including the days you did not. Before you share a recovery challenge with someone, be sure you want that person to know. We will ask you to confirm it, and once they have seen something we cannot unsee it for them.'
    },

    { kind: 'heading', id: 'h-medication', text: 'Medication reminders' },
    {
      kind: 'paragraph',
      id: 'p-medication',
      text: 'Habiti can record that you took medication. It is a diary, not a reminder system you should rely on: it does not know your prescription, it will not alert anyone if you miss a dose, and it may be unavailable. Never rely on Habiti as your only way of remembering medication.'
    },

    { kind: 'heading', id: 'h-injury', text: 'Exercise' },
    {
      kind: 'paragraph',
      id: 'p-injury',
      text: 'Habiti describes exercises and suggests loads and durations. It has never seen you and knows nothing about your health or injuries. Get advice before starting a new exercise routine, and stop if something hurts.'
    },

    { kind: 'heading', id: 'h-accuracy', text: 'What the numbers mean' },
    {
      kind: 'paragraph',
      id: 'p-accuracy',
      text: 'Streaks, levels and completion rates are arithmetic on what you typed in. They are not a measure of your health or your progress in recovery, and a broken streak is not a verdict on you.'
    }
  ]
};
