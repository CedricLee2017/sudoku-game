(function (root) {
  'use strict';

  const SIZE = 9;
  const BOX = 3;
  const FULL_MASK = (1 << SIZE) - 1;
  const MAX_SEARCH_NODES = 250000;
  const MIN_JIGSAW_SWAPS = 18;
  const MIN_JIGSAW_CHANGED_CELLS = 12;

  function normalizeMode(mode) {
    if (mode === 'diagonal' || mode === 'x-sudoku') return 'diagonal';
    if (mode === 'jigsaw' || mode === 'irregular') return 'jigsaw';
    return 'standard';
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

  function unitIndex(row, col, mode, regions) {
    return mode === 'jigsaw' ? regions[row * SIZE + col] : boxIndex(row, col);
  }

  function candidatesFor(row, col, rowMask, colMask, unitMask, mainDiagonalMask, antiDiagonalMask, diagonal, mode = 'standard', regions = null) {
    let used = rowMask[row] | colMask[col] | unitMask[unitIndex(row, col, mode, regions)];
    if (diagonal && row === col) used |= mainDiagonalMask;
    if (diagonal && row + col === SIZE - 1) used |= antiDiagonalMask;
    return FULL_MASK & ~used;
  }

  function isConnectedRegion(regions, regionId) {
    const members = [];
    for (let index = 0; index < regions.length; index += 1) {
      if (regions[index] === regionId) members.push(index);
    }
    if (members.length !== SIZE) return false;

    const visited = new Set([members[0]]);
    const stack = [members[0]];
    while (stack.length) {
      const index = stack.pop();
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const neighbors = [
        row > 0 ? index - SIZE : -1,
        row < SIZE - 1 ? index + SIZE : -1,
        col > 0 ? index - 1 : -1,
        col < SIZE - 1 ? index + 1 : -1
      ];
      for (const next of neighbors) {
        if (next >= 0 && regions[next] === regionId && !visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    return visited.size === SIZE;
  }

  function isValidJigsawRegions(regions) {
    if (!Array.isArray(regions) || regions.length !== SIZE * SIZE) return false;
    const counts = Array(SIZE).fill(0);
    for (const regionId of regions) {
      if (!Number.isInteger(regionId) || regionId < 0 || regionId >= SIZE) return false;
      counts[regionId] += 1;
    }
    return counts.every((count) => count === SIZE) &&
      Array.from({ length: SIZE }, (_, regionId) => isConnectedRegion(regions, regionId)).every(Boolean);
  }

  function hasNoStandardBoxRegions(regions) {
    for (let regionId = 0; regionId < SIZE; regionId += 1) {
      for (let standardBox = 0; standardBox < SIZE; standardBox += 1) {
        let overlap = 0;
        for (let index = 0; index < regions.length; index += 1) {
          const row = Math.floor(index / SIZE);
          const col = index % SIZE;
          if (regions[index] === regionId && boxIndex(row, col) === standardBox) overlap += 1;
        }
        if (overlap === SIZE) return false;
      }
    }
    return true;
  }

  function isConnectedAfterSwap(regions, first, second) {
    const firstRegion = regions[first];
    const secondRegion = regions[second];
    regions[first] = secondRegion;
    regions[second] = firstRegion;
    const connected = isConnectedRegion(regions, firstRegion) && isConnectedRegion(regions, secondRegion);
    regions[first] = firstRegion;
    regions[second] = secondRegion;
    return connected;
  }

  function tryCreateJigsawRegions(solution) {
    const flatSolution = Array.isArray(solution[0]) ? solution.flat() : solution.slice();
    if (flatSolution.length !== SIZE * SIZE || flatSolution.some((value) => !Number.isInteger(value) || value < 1 || value > SIZE)) return null;

    for (let layoutAttempt = 0; layoutAttempt < 24; layoutAttempt += 1) {
      const regions = Array.from({ length: SIZE * SIZE }, (_, index) => {
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        return boxIndex(row, col);
      });
      let acceptedSwaps = 0;
      let attempts = 0;

      while (acceptedSwaps < 160 && attempts < 1200) {
        attempts += 1;
        const pairs = [];
        for (let first = 0; first < regions.length; first += 1) {
          for (let second = first + 1; second < regions.length; second += 1) {
            if (regions[first] !== regions[second] && flatSolution[first] === flatSolution[second]) {
              pairs.push([first, second]);
            }
          }
        }
        if (!pairs.length) break;

        let swapped = false;
        for (const [first, second] of shuffle(pairs)) {
          if (!isConnectedAfterSwap(regions, first, second)) continue;
          [regions[first], regions[second]] = [regions[second], regions[first]];
          acceptedSwaps += 1;
          swapped = true;
          break;
        }
        if (!swapped) break;

        const changedCells = regions.reduce((count, regionId, index) => {
          const row = Math.floor(index / SIZE);
          const col = index % SIZE;
          const original = boxIndex(row, col);
          return count + (regionId !== original ? 1 : 0);
        }, 0);
        if (acceptedSwaps >= MIN_JIGSAW_SWAPS && changedCells >= MIN_JIGSAW_CHANGED_CELLS &&
            isValidJigsawRegions(regions) && hasNoStandardBoxRegions(regions)) {
          return regions;
        }
      }
    }
    return null;
  }

  function createJigsawSolvedGrid() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const solution = createStandardSolvedGrid();
      const regions = tryCreateJigsawRegions(solution);
      if (regions) return { solution, regions };
    }
    throw new Error('Unable to create a connected Jigsaw Sudoku region map.');
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
      for (let bit = 1; bit <= FULL_MASK; bit <<= 1) if (bestCandidates & bit) choices.push(bitToDigit(bit));
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

    if (!search()) return createDiagonalSolvedGridRetry();
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
    const normalizedMode = normalizeMode(mode);
    if (normalizedMode === 'diagonal') return createDiagonalSolvedGrid();
    if (normalizedMode === 'jigsaw') return createJigsawSolvedGrid().solution;
    return createStandardSolvedGrid();
  }

  function countSolutions(input, limit = 2, mode = 'standard', nodeLimit = MAX_SEARCH_NODES, regions = null) {
    if (typeof mode === 'number') {
      nodeLimit = mode;
      mode = 'standard';
    }
    if (Array.isArray(nodeLimit)) {
      regions = nodeLimit;
      nodeLimit = MAX_SEARCH_NODES;
    }
    const normalizedMode = normalizeMode(mode);
    const diagonal = normalizedMode === 'diagonal';
    const jigsaw = normalizedMode === 'jigsaw';
    if (jigsaw && !isValidJigsawRegions(regions)) return 0;

    const board = input.flat();
    if (board.length !== SIZE * SIZE) return 0;
    const rowMask = Array(SIZE).fill(0);
    const colMask = Array(SIZE).fill(0);
    const unitMask = Array(SIZE).fill(0);
    let mainDiagonalMask = 0;
    let antiDiagonalMask = 0;
    let solutions = 0;
    let nodes = 0;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const index = row * SIZE + col;
        const value = board[index];
        if (!Number.isInteger(value) || value < 0 || value > SIZE) return 0;
        if (!value) continue;
        const bit = 1 << (value - 1);
        const group = unitIndex(row, col, normalizedMode, regions);
        if ((rowMask[row] & bit) || (colMask[col] & bit) || (unitMask[group] & bit)) return 0;
        if (diagonal && row === col && (mainDiagonalMask & bit)) return 0;
        if (diagonal && row + col === SIZE - 1 && (antiDiagonalMask & bit)) return 0;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        unitMask[group] |= bit;
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
        const candidates = candidatesFor(row, col, rowMask, colMask, unitMask, mainDiagonalMask, antiDiagonalMask, diagonal, normalizedMode, regions);
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
      const group = unitIndex(row, col, normalizedMode, regions);
      const choices = [];
      for (let bit = 1; bit <= FULL_MASK; bit <<= 1) if (bestCandidates & bit) choices.push(bitToDigit(bit));
      for (const digit of shuffle(choices)) {
        const bit = 1 << (digit - 1);
        board[bestIndex] = digit;
        rowMask[row] |= bit;
        colMask[col] |= bit;
        unitMask[group] |= bit;
        if (diagonal && row === col) mainDiagonalMask |= bit;
        if (diagonal && row + col === SIZE - 1) antiDiagonalMask |= bit;
        search();
        board[bestIndex] = 0;
        rowMask[row] &= ~bit;
        colMask[col] &= ~bit;
        unitMask[group] &= ~bit;
        if (diagonal && row === col) mainDiagonalMask &= ~bit;
        if (diagonal && row + col === SIZE - 1) antiDiagonalMask &= ~bit;
        if (solutions >= limit || nodes >= nodeLimit) return;
      }
    }

    search();
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
    let solution;
    let regions = null;
    if (normalizedMode === 'jigsaw') {
      const generated = createJigsawSolvedGrid();
      solution = generated.solution;
      regions = generated.regions;
    } else {
      solution = createSolvedGrid(normalizedMode);
    }

    const puzzle = solution.map((row) => row.slice());
    const positions = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
    let clues = SIZE * SIZE;
    for (const position of positions) {
      if (clues <= targetClues) break;
      const row = Math.floor(position / SIZE);
      const col = position % SIZE;
      const value = puzzle[row][col];
      puzzle[row][col] = 0;
      if (countSolutions(puzzle, 2, normalizedMode, MAX_SEARCH_NODES, regions) === 1) clues -= 1;
      else puzzle[row][col] = value;
    }
    return { puzzle, solution, clueCount: clues, mode: normalizedMode, regions };
  }

  const api = {
    countSolutions,
    generatePuzzle,
    createSolvedGrid,
    createJigsawRegions: tryCreateJigsawRegions,
    isValidJigsawRegions,
    isDiagonalMode,
    normalizeMode
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SudokuEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
