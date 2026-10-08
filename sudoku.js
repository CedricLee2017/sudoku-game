(function (root) {
  'use strict';

  const SIZE = 9;
  const BOX = 3;

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

  function createSolvedGrid() {
    const rows = randomizedGroups();
    const cols = randomizedGroups();
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return rows.map((r) =>
      cols.map((c) => digits[(r * BOX + Math.floor(r / BOX) + c) % SIZE])
    );
  }

  function countSolutions(input, limit = 2, nodeLimit = 100000) {
    const board = input.flat();
    const rowMask = Array(SIZE).fill(0);
    const colMask = Array(SIZE).fill(0);
    const boxMask = Array(SIZE).fill(0);
    const fullMask = (1 << SIZE) - 1;
    let solutions = 0;
    let nodes = 0;

    const boxIndex = (row, col) => Math.floor(row / BOX) * BOX + Math.floor(col / BOX);
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const value = board[row * SIZE + col];
        if (!value) continue;
        const bit = 1 << (value - 1);
        const box = boxIndex(row, col);
        if ((rowMask[row] & bit) || (colMask[col] & bit) || (boxMask[box] & bit)) return 0;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
      }
    }

    function search() {
      if (solutions >= limit || nodes >= nodeLimit) return;
      nodes += 1;
      let bestIndex = -1;
      let bestCandidates = 0;
      let bestCount = SIZE + 1;

      for (let index = 0; index < board.length; index += 1) {
        if (board[index] !== 0) continue;
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const box = boxIndex(row, col);
        const candidates = fullMask & ~(rowMask[row] | colMask[col] | boxMask[box]);
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
      for (let bit = 1; bit <= fullMask; bit <<= 1) {
        if (!(bestCandidates & bit)) continue;
        board[bestIndex] = bitToDigit(bit);
        rowMask[row] |= bit;
        colMask[col] |= bit;
        boxMask[box] |= bit;
        search();
        board[bestIndex] = 0;
        rowMask[row] ^= bit;
        colMask[col] ^= bit;
        boxMask[box] ^= bit;
        if (solutions >= limit || nodes >= nodeLimit) return;
      }
    }

    search();
    // 若搜尋超出節點上限，保守地不把候選題目視為唯一解。
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

  function generatePuzzle(difficulty = 'medium') {
    const targets = { easy: 40, medium: 34, hard: 29 };
    const targetClues = targets[difficulty] || targets.medium;
    const solution = createSolvedGrid();
    const puzzle = solution.map((row) => row.slice());
    const positions = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
    let clues = SIZE * SIZE;

    for (const position of positions) {
      if (clues <= targetClues) break;
      const row = Math.floor(position / SIZE);
      const col = position % SIZE;
      const value = puzzle[row][col];
      puzzle[row][col] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues -= 1;
      } else {
        puzzle[row][col] = value;
      }
    }

    return { puzzle, solution, clueCount: clues };
  }

  const api = { countSolutions, generatePuzzle, createSolvedGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SudokuEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
