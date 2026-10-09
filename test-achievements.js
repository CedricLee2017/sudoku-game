'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Achievements = require('./achievements.js');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    data
  };
}

function complete(progress, context = {}, storage) {
  return Achievements.recordCompletion(progress, {
    mode: 'standard',
    difficulty: 'medium',
    elapsedSeconds: 600,
    usedHint: true,
    isDaily: false,
    ...context
  }, storage);
}

test('catalog lists all seven requested achievements', () => {
  assert.deepEqual(Achievements.BADGES.map(({ title }) => title), [
    '初出茅廬', '對角線大師', '異形解構者', '閃電俠', '深謀遠慮', '堅持不懈', '數獨宗師'
  ]);
});

test('first completed game and hint-free completion unlock their badges', () => {
  const result = complete(Achievements.createEmptyProgress(), { usedHint: false });
  assert.deepEqual(result.newlyUnlocked.map(({ id }) => id), ['first-win', 'no-hints']);
  assert.equal(result.progress.stats.completedGames, 1);
  assert.equal(result.progress.stats.hintlessWins, 1);
});

test('mode achievements unlock only for their corresponding completed mode', () => {
  const diagonal = complete(Achievements.createEmptyProgress(), { mode: 'diagonal', usedHint: true });
  assert.ok(diagonal.progress.unlocked.includes('diagonal-master'));
  assert.ok(!diagonal.progress.unlocked.includes('jigsaw-solver'));

  const jigsaw = complete(diagonal.progress, { mode: 'jigsaw', usedHint: true });
  assert.ok(jigsaw.progress.unlocked.includes('jigsaw-solver'));
});

test('speed solver requires an easy puzzle completed strictly under three minutes', () => {
  const fast = complete(Achievements.createEmptyProgress(), { difficulty: 'easy', elapsedSeconds: 179, usedHint: true });
  assert.ok(fast.progress.unlocked.includes('speed-solver'));

  const boundary = complete(Achievements.createEmptyProgress(), { difficulty: 'easy', elapsedSeconds: 180, usedHint: true });
  assert.ok(!boundary.progress.unlocked.includes('speed-solver'));
});

test('using a hint prevents the no-hints badge for that completion', () => {
  const result = complete(Achievements.createEmptyProgress(), { usedHint: true });
  assert.ok(!result.progress.unlocked.includes('no-hints'));
  assert.equal(result.progress.stats.hintlessWins, 0);
});

test('daily streak unlocks after completing three consecutive local-date challenges', () => {
  let progress = Achievements.createEmptyProgress();
  const dates = ['2026-10-07', '2026-10-08', '2026-10-09'];
  let result;
  for (const dailyDate of dates) {
    result = complete(progress, { isDaily: true, dailyDate });
    progress = result.progress;
  }
  assert.ok(progress.unlocked.includes('daily-streak'));
  assert.deepEqual(progress.stats.dailyCompletionDates, dates);
  assert.equal(Achievements.currentDailyStreak(dates, '2026-10-09'), 3);
});

test('a missed daily date breaks the three-day streak', () => {
  assert.equal(Achievements.hasThreeDayStreak(['2026-10-06', '2026-10-08', '2026-10-09'], '2026-10-09'), false);
});

test('ten completed games unlock the master badge', () => {
  let progress = Achievements.createEmptyProgress();
  for (let i = 0; i < 10; i += 1) progress = complete(progress, { usedHint: true }).progress;
  assert.equal(progress.stats.completedGames, 10);
  assert.ok(progress.unlocked.includes('ten-games'));
});

test('progress is persisted and reloaded from LocalStorage-compatible storage', () => {
  const storage = memoryStorage();
  const result = complete(Achievements.createEmptyProgress(), { mode: 'jigsaw' }, storage);
  const reloaded = Achievements.loadProgress(storage);
  assert.deepEqual(reloaded, result.progress);
  assert.ok(reloaded.unlocked.includes('jigsaw-solver'));
});

test('corrupted LocalStorage falls back safely and invalid dates are ignored', () => {
  const storage = memoryStorage({ [Achievements.STORAGE_KEY]: '{not-json' });
  assert.deepEqual(Achievements.loadProgress(storage), Achievements.createEmptyProgress());
  assert.equal(Achievements.isDateKey('2026-02-30'), false);
  assert.equal(Achievements.isDateKey('2026-02-28'), true);
});
