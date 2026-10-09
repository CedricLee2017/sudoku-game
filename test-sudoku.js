'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { countSolutions, createSolvedGrid, generatePuzzle, isValidJigsawRegions } = require('./sudoku.js');

function hasDigitsOneToNine(values) {
  return values.length === 9 && new Set(values).size === 9 && values.every((value) => Number.isInteger(value) && value >= 1 && value <= 9);
}

function assertJigsawRegions(regions, solution) {
  assert.ok(isValidJigsawRegions(regions), 'nine connected regions with exactly nine cells each');
  const boxMap = Array.from({ length: 81 }, (_, index) => Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3));
  for (let regionId = 0; regionId < 9; regionId += 1) {
    const regionCells = regions.map((value, index) => value === regionId ? index : -1).filter((index) => index >= 0);
    assert.equal(regionCells.length, 9, `Jigsaw region ${regionId + 1} size`);
    for (let boxId = 0; boxId < 9; boxId += 1) {
      assert.notEqual(regionCells.filter((index) => boxMap[index] === boxId).length, 9, `Jigsaw region ${regionId + 1} is not a standard box`);
    }
    const digits = regionCells.map((index) => solution.flat()[index]);
    assert.ok(hasDigitsOneToNine(digits), `Jigsaw region ${regionId + 1}`);
  }
}

function assertValidGrid(grid, mode, regions = null) {
  assert.equal(grid.length, 9);
  for (let row = 0; row < 9; row += 1) {
    assert.ok(hasDigitsOneToNine(grid[row]), `row ${row + 1}`);
    assert.ok(hasDigitsOneToNine(grid.map((values) => values[row])), `column ${row + 1}`);
  }

  if (mode === 'standard' || mode === 'diagonal') {
    for (let boxRow = 0; boxRow < 9; boxRow += 3) {
      for (let boxCol = 0; boxCol < 9; boxCol += 3) {
        const values = [];
        for (let row = boxRow; row < boxRow + 3; row += 1) {
          for (let col = boxCol; col < boxCol + 3; col += 1) values.push(grid[row][col]);
        }
        assert.ok(hasDigitsOneToNine(values), `box ${boxRow / 3 + 1},${boxCol / 3 + 1}`);
      }
    }
  }

  if (mode === 'diagonal') {
    assert.ok(hasDigitsOneToNine(grid.map((row, index) => row[index])), 'main diagonal');
    assert.ok(hasDigitsOneToNine(grid.map((row, index) => row[8 - index])), 'anti diagonal');
  }
  if (mode === 'jigsaw') assertJigsawRegions(regions, grid);
}

for (const mode of ['standard', 'diagonal', 'jigsaw']) {
  test(`${mode}: full grid obeys all selected rules`, () => {
    const generated = mode === 'jigsaw' ? generatePuzzle('easy', mode) : { solution: createSolvedGrid(mode), regions: null };
    assertValidGrid(generated.solution, mode, generated.regions);
  });

  for (const difficulty of ['easy', 'medium', 'hard']) {
    test(`${mode}/${difficulty}: generated puzzle has exactly one solution`, () => {
      const { puzzle, solution, clueCount, regions } = generatePuzzle(difficulty, mode);
      assertValidGrid(solution, mode, regions);
      assert.equal(puzzle.flat().filter(Boolean).length, clueCount);
      assert.equal(countSolutions(puzzle, 2, mode, 250000, regions), 1);
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          if (puzzle[row][col]) assert.equal(puzzle[row][col], solution[row][col]);
        }
      }
    });
  }
}

test('diagonal mode rejects a diagonal duplicate that standard Sudoku accepts', () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  puzzle[0][0] = 1;
  puzzle[4][4] = 1;
  assert.equal(countSolutions(puzzle, 2, 'standard') > 0, true);
  assert.equal(countSolutions(puzzle, 2, 'diagonal'), 0);
});

test('Jigsaw solver rejects a missing or disconnected region map', () => {
  const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
  assert.equal(countSolutions(empty, 2, 'jigsaw'), 0);
  const disconnected = Array.from({ length: 81 }, (_, index) => (Math.floor(index / 9) + index % 9) % 9);
  assert.equal(isValidJigsawRegions(disconnected), false);
  assert.equal(countSolutions(empty, 2, 'jigsaw', 250000, disconnected), 0);
});
