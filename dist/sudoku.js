(function (root) {
  'use strict';

  const SIZE = 9;
  const BOX = 3;
  const FULL_MASK = (1 << SIZE) - 1;
  const MAX_SEARCH_NODES = 250000;

  function normalizeMode(mode) {
    return mode === 'diagonal' || mode === 'x-sudoku' ? 'diagonal' : 'standard';
  }

  function isDiagonalMode(mode) {
    return normalizeMode(mode) === 'diagonal';
  }

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function randomizedGroups() {
    return shuffle([0, 1, 2]).flatMap((group) =>
      shuffle([0, 1, 2]).map((offset) => group * 3 + offset)
    );
  }

  function createStandardSolvedGrid() {
    const rows = randomizedGroups();
    const cols = randomizedGroups();
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return rows.map((r) =>
      cols.map((c) => digits[(r * BOX + Math.floor(r / BOX) + c) % SIZE])
    );
  }

  function boxIndex(row, col) {
    return Math.floor(row / BOX) * BOX + Math.floor(col / BOX);
  }

  function candidatesFor(row, col, rowMask, colMask, boxMask, mainDiagonalMask, antiDiagonalMask, diagonal) {
    let used = rowMask[row] | colMask[col] | boxMask[boxIndex(row, col)];
    if (diagonal && row === col) used |= mainDiagonalMask;
    if (diagonal && row + col === SIZE - 1) used |= antiDiagonalMask;
    return FULL_MASK & ~used;
  }

  function createDiagonalSolvedGrid() {
    const board = Array(SIZE * SIZE).fill(0);
    const rowMask = Array(SIZE).fill(0);
    const colMask = Array(SIZE).fill(0);
    const boxMask = Array(SIZE).fill(0);
    let mainDiagonalMask = 0;
    let antiDiagonalMask = 0;
    let nodes = 0;

    function search() {
      nodes += 1;
      if (nodes > MAX_SEARCH_NODES) return false;

      let bestIndex = -1;
      let bestCandidates = 0;
      let bestCount = SIZE + 1;
      const start = Math.floor(Math.random() * board.length);

      for (let offset = 0; offset < board.length; offset += 1) {
        const index = (start + offset) % board.length;
        if (board[index] !== 0) continue;
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const candidates = candidatesFor(row, col, rowMask, colMask, boxMask, mainDiagonalMask, antiDiagonalMask, true);
        const count = bitCount(candidates);
        if (count === 0) return false;
        if (count < bestCount) {
          bestIndex = index;
          bestCandidates = candidates;
          bestCount = count;
          if (count === 1) break;
        }
      }

      if (bestIndex === -1) return true;

      const row = Math.floor(bestIndex / SIZE);
      const col = bestIndex % SIZE;
      const box = boxIndex(row, col);
      const choices = [];
      for (let bit = 1; bit <= FULL_MASK; bit <<= 1) {
        if (bestCandidates & bit) choices.push(bitToDigit(bit));
      }

      for (const digit of shuffle(choices)) {
        const bit = 1 << (digit - 1);
        board[bestIndex] = digit;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
        if (row === col) mainDiagonalMask |= bit;
        if (row + col === SIZE - 1) antiDiagonalMask |= bit;

        if (search()) return true;

        board[bestIndex] = 0;
        rowMask[row] &= ~bit;
        colMask[col] &= ~bit;
        boxMask[box] &= ~bit;
        if (row === col) mainDiagonalMask &= ~bit;
        if (row + col === SIZE - 1) antiDiagonalMask &= ~bit;
      }
      return false;
    }

    if (!search()) {
      // Restart once with fresh randomized branching if a rare hard branch hits its node limit.
      return createDiagonalSolvedGridRetry();
    }
    return Array.from({ length: SIZE }, (_, row) => board.slice(row * SIZE, (row + 1) * SIZE));
  }

  function createDiagonalSolvedGridRetry() {
    const board = Array(SIZE * SIZE).fill(0);
    const rowMask = Array(SIZE).fill(0);
    const colMask = Array(SIZE).fill(0);
    const boxMask = Array(SIZE).fill(0);
    let mainDiagonalMask = 0;
    let antiDiagonalMask = 0;
    let nodes = 0;

    function search() {
      nodes += 1;
      if (nodes > MAX_SEARCH_NODES) return false;
      let bestIndex = -1;
      let bestMask = 0;
      let bestCount = SIZE + 1;
      const start = Math.floor(Math.random() * board.length);
      for (let offset = 0; offset < board.length; offset += 1) {
        const index = (start + offset) % board.length;
        if (board[index]) continue;
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const mask = candidatesFor(row, col, rowMask, colMask, boxMask, mainDiagonalMask, antiDiagonalMask, true);
        const count = bitCount(mask);
        if (!count) return false;
        if (count < bestCount) {
          bestIndex = index;
          bestMask = mask;
          bestCount = count;
          if (count === 1) break;
        }
      }
      if (bestIndex < 0) return true;
      const row = Math.floor(bestIndex / SIZE);
      const col = bestIndex % SIZE;
      const box = boxIndex(row, col);
      const choices = [];
      for (let bit = 1; bit <= FULL_MASK; bit <<= 1) if (bestMask & bit) choices.push(bitToDigit(bit));
      for (const digit of shuffle(choices)) {
        const bit = 1 << (digit - 1);
        board[bestIndex] = digit;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
        if (row === col) mainDiagonalMask |= bit;
        if (row + col === SIZE - 1) antiDiagonalMask |= bit;
        if (search()) return true;
        board[bestIndex] = 0;
        rowMask[row] &= ~bit;
        colMask[col] &= ~bit;
        boxMask[box] &= ~bit;
        if (row === col) mainDiagonalMask &= ~bit;
        if (row + col === SIZE - 1) antiDiagonalMask &= ~bit;
      }
      return false;
    }

    if (!search()) throw new Error('Unable to generate a valid X-Sudoku grid within the search limit.');
    return Array.from({ length: SIZE }, (_, row) => board.slice(row * SIZE, (row + 1) * SIZE));
  }

  function createSolvedGrid(mode = 'standard') {
    return isDiagonalMode(mode) ? createDiagonalSolvedGrid() : createStandardSolvedGrid();
  }

  function countSolutions(input, limit = 2, mode = 'standard', nodeLimit = MAX_SEARCH_NODES) {
    if (typeof mode === 'number') {
      nodeLimit = mode;
      mode = 'standard';
    }
    const diagonal = isDiagonalMode(mode);
    const board = input.flat();
    if (board.length !== SIZE * SIZE) return 0;

    const rowMask = Array(SIZE).fill(0);
    const colMask = Array(SIZE).fill(0);
    const boxMask = Array(SIZE).fill(0);
    let mainDiagonalMask = 0;
    let antiDiagonalMask = 0;
    let solutions = 0;
    let nodes = 0;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const value = board[row * SIZE + col];
        if (!Number.isInteger(value) || value < 0 || value > SIZE) return 0;
        if (!value) continue;
        const bit = 1 << (value - 1);
        const box = boxIndex(row, col);
        if ((rowMask[row] & bit) || (colMask[col] & bit) || (boxMask[box] & bit)) return 0;
        if (diagonal && row === col && (mainDiagonalMask & bit)) return 0;
        if (diagonal && row + col === SIZE - 1 && (antiDiagonalMask & bit)) return 0;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
        if (diagonal && row === col) mainDiagonalMask |= bit;
        if (diagonal && row + col === SIZE - 1) antiDiagonalMask |= bit;
      }
    }

    function search() {
      if (solutions >= limit || nodes >= nodeLimit) return;
      nodes += 1;
      let bestIndex = -1;
      let bestCandidates = 0;
      let bestCount = SIZE + 1;
      const start = Math.floor(Math.random() * board.length);

      for (let offset = 0; offset < board.length; offset += 1) {
        const index = (start + offset) % board.length;
        if (board[index] !== 0) continue;
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const candidates = candidatesFor(row, col, rowMask, colMask, boxMask, mainDiagonalMask, antiDiagonalMask, diagonal);
        const count = bitCount(candidates);
        if (count === 0) return;
        if (count < bestCount) {
          bestIndex = index;
          bestCandidates = candidates;
          bestCount = count;
          if (count === 1) break;
        }
      }

      if (bestIndex === -1) {
        solutions += 1;
        return;
      }

      const row = Math.floor(bestIndex / SIZE);
      const col = bestIndex % SIZE;
      const box = boxIndex(row, col);
      const choices = [];
      for (let bit = 1; bit <= FULL_MASK; bit <<= 1) if (bestCandidates & bit) choices.push(bitToDigit(bit));
      for (const digit of shuffle(choices)) {
        const bit = 1 << (digit - 1);
        board[bestIndex] = digit;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
        if (diagonal && row === col) mainDiagonalMask |= bit;
        if (diagonal && row + col === SIZE - 1) antiDiagonalMask |= bit;
        search();
        board[bestIndex] = 0;
        rowMask[row] &= ~bit;
        colMask[col] &= ~bit;
        boxMask[box] &= ~bit;
        if (diagonal && row === col) mainDiagonalMask &= ~bit;
        if (diagonal && row + col === SIZE - 1) antiDiagonalMask &= ~bit;
        if (solutions >= limit || nodes >= nodeLimit) return;
      }
    }

    search();
    // If the search limit is reached before ruling out a second solution, fail closed.
    if (nodes >= nodeLimit && solutions < limit) return limit;
    return solutions;
  }

  function bitCount(value) {
    let count = 0;
    while (value) {
      value &= value - 1;
      count += 1;
    }
    return count;
  }

  function bitToDigit(bit) {
    let digit = 1;
    while (bit > 1) {
      bit >>= 1;
      digit += 1;
    }
    return digit;
  }

  function generatePuzzle(difficulty = 'medium', mode = 'standard') {
    const targets = { easy: 40, medium: 34, hard: 29 };
    const targetClues = targets[difficulty] || targets.medium;
    const normalizedMode = normalizeMode(mode);
    const solution = createSolvedGrid(normalizedMode);
    const puzzle = solution.map((row) => row.slice());
    const positions = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
    let clues = SIZE * SIZE;

    for (const position of positions) {
      if (clues <= targetClues) break;
      const row = Math.floor(position / SIZE);
      const col = position % SIZE;
      const value = puzzle[row][col];
      puzzle[row][col] = 0;
      if (countSolutions(puzzle, 2, normalizedMode) === 1) {
        clues -= 1;
      } else {
        puzzle[row][col] = value;
      }
    }

    return { puzzle, solution, clueCount: clues, mode: normalizedMode };
  }

  const api = { countSolutions, generatePuzzle, createSolvedGrid, isDiagonalMode, normalizeMode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SudokuEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
