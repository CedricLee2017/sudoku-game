(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SudokuAchievements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'jiuge-daily-achievements-v1';
  const BADGES = Object.freeze([
    Object.freeze({ id: 'first-win', title: '初出茅廬', icon: '✧', description: '完成任意難度的第一盤數獨。' }),
    Object.freeze({ id: 'diagonal-master', title: '對角線大師', icon: '╳', description: '完成 1 盤 X-Sudoku（對角線數獨）。' }),
    Object.freeze({ id: 'jigsaw-solver', title: '異形解構者', icon: '▦', description: '完成 1 盤 Jigsaw Sudoku（鋸齒數獨）。' }),
    Object.freeze({ id: 'speed-solver', title: '閃電俠', icon: '⚡', description: '在 3 分鐘內完成一盤簡單難度的數獨。' }),
    Object.freeze({ id: 'no-hints', title: '深謀遠慮', icon: '♟', description: '通關且過程中完全沒有使用「提示（Hint）」功能。' }),
    Object.freeze({ id: 'daily-streak', title: '堅持不懈', icon: '◷', description: '連續 3 天完成「每日一題」挑戰。' }),
    Object.freeze({ id: 'ten-games', title: '數獨宗師', icon: '✦', description: '完成至少 10 盤數獨遊戲。' })
  ]);

  const BADGE_IDS = new Set(BADGES.map((badge) => badge.id));

  function createEmptyProgress() {
    return {
      version: 1,
      unlocked: [],
      stats: {
        completedGames: 0,
        hintlessWins: 0,
        fastEasyWins: 0,
        dailyCompletionDates: []
      }
    };
  }

  function isDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dayNumber(dateKey) {
    if (!isDateKey(dateKey)) return NaN;
    return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  }

  function normalizeProgress(value) {
    const source = value && typeof value === 'object' ? value : {};
    const stats = source.stats && typeof source.stats === 'object' ? source.stats : {};
    const nonNegativeInteger = (input) => {
      const numeric = Number(input);
      return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    };
    const unlocked = Array.isArray(source.unlocked)
      ? [...new Set(source.unlocked.filter((id) => BADGE_IDS.has(id)))]
      : [];
    const dates = Array.isArray(stats.dailyCompletionDates)
      ? [...new Set(stats.dailyCompletionDates.filter(isDateKey))].sort().slice(-400)
      : [];

    return {
      version: 1,
      unlocked,
      stats: {
        completedGames: nonNegativeInteger(stats.completedGames),
        hintlessWins: nonNegativeInteger(stats.hintlessWins),
        fastEasyWins: nonNegativeInteger(stats.fastEasyWins),
        dailyCompletionDates: dates
      }
    };
  }

  function getStorage(storageOverride) {
    if (storageOverride) return storageOverride;
    try {
      return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
    } catch (_error) {
      return null;
    }
  }

  function loadProgress(storageOverride) {
    const storage = getStorage(storageOverride);
    if (!storage || typeof storage.getItem !== 'function') return createEmptyProgress();
    try {
      const stored = storage.getItem(STORAGE_KEY);
      return stored ? normalizeProgress(JSON.parse(stored)) : createEmptyProgress();
    } catch (_error) {
      return createEmptyProgress();
    }
  }

  function saveProgress(progress, storageOverride) {
    const storage = getStorage(storageOverride);
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function hasThreeDayStreak(dateKeys, todayKey) {
    if (!isDateKey(todayKey) || !Array.isArray(dateKeys)) return false;
    const dates = new Set(dateKeys.filter(isDateKey).map(dayNumber));
    const today = dayNumber(todayKey);
    return dates.has(today) && dates.has(today - 1) && dates.has(today - 2);
  }

  function currentDailyStreak(dateKeys, todayKey = localDateKey()) {
    if (!isDateKey(todayKey) || !Array.isArray(dateKeys)) return 0;
    const dates = new Set(dateKeys.filter(isDateKey).map(dayNumber));
    let cursor = dayNumber(todayKey);
    if (!dates.has(cursor)) cursor -= 1;
    let count = 0;
    while (dates.has(cursor)) {
      count += 1;
      cursor -= 1;
    }
    return count;
  }

  function progressLabel(badgeId, progress, todayKey = localDateKey()) {
    const normalized = normalizeProgress(progress);
    const stats = normalized.stats;
    const isUnlocked = normalized.unlocked.includes(badgeId);
    const fraction = (value, target) => `${Math.min(value, target)} / ${target}`;
    switch (badgeId) {
      case 'first-win': return fraction(stats.completedGames, 1);
      case 'diagonal-master': return isUnlocked ? '已達成' : '完成 1 盤 X-Sudoku';
      case 'jigsaw-solver': return isUnlocked ? '已達成' : '完成 1 盤 Jigsaw';
      case 'speed-solver': return isUnlocked ? '已達成' : '簡單難度 · 03:00 內';
      case 'no-hints': return fraction(stats.hintlessWins, 1);
      case 'daily-streak': return `${Math.min(currentDailyStreak(stats.dailyCompletionDates, todayKey), 3)} / 3 天`;
      case 'ten-games': return fraction(stats.completedGames, 10);
      default: return '';
    }
  }

  function recordCompletion(progress, context = {}, storageOverride) {
    const next = normalizeProgress(progress);
    const newUnlocks = [];
    const seconds = Number(context.elapsedSeconds);
    next.stats.completedGames += 1;

    if (!context.usedHint) next.stats.hintlessWins += 1;
    if (context.difficulty === 'easy' && Number.isFinite(seconds) && seconds >= 0 && seconds < 180) {
      next.stats.fastEasyWins += 1;
    }
    if (context.isDaily && isDateKey(context.dailyDate)) {
      next.stats.dailyCompletionDates = [...new Set([...next.stats.dailyCompletionDates, context.dailyDate])].sort().slice(-400);
    }

    const unlock = (id) => {
      if (BADGE_IDS.has(id) && !next.unlocked.includes(id)) {
        next.unlocked.push(id);
        newUnlocks.push(BADGES.find((badge) => badge.id === id));
      }
    };

    if (next.stats.completedGames >= 1) unlock('first-win');
    if (context.mode === 'diagonal') unlock('diagonal-master');
    if (context.mode === 'jigsaw') unlock('jigsaw-solver');
    if (context.difficulty === 'easy' && Number.isFinite(seconds) && seconds >= 0 && seconds < 180) unlock('speed-solver');
    if (!context.usedHint) unlock('no-hints');
    if (context.isDaily && hasThreeDayStreak(next.stats.dailyCompletionDates, context.dailyDate)) unlock('daily-streak');
    if (next.stats.completedGames >= 10) unlock('ten-games');

    saveProgress(next, storageOverride);
    return { progress: next, newlyUnlocked: newUnlocks };
  }

  return Object.freeze({
    STORAGE_KEY,
    BADGES,
    createEmptyProgress,
    normalizeProgress,
    loadProgress,
    saveProgress,
    localDateKey,
    isDateKey,
    hasThreeDayStreak,
    currentDailyStreak,
    progressLabel,
    recordCompletion
  });
});
