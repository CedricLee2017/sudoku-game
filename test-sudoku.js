'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { countSolutions, createSolvedGrid, generatePuzzle } = require('./sudoku.js');

function hasDigitsOneToNine(values) {
  return values.length === 9 && new Set(values).size === 9 && values.every((value) => Number.isInteger(value) && value >= 1 && value <= 9);
}

function assertValidGrid(grid, diagonal) {
  assert.equal(grid.length, 9);
  for (let row = 0; row < 9; row += 1) {
    assert.ok(hasDigitsOneToNine(grid[row]), `row ${row + 1}`);
    assert.ok(hasDigitsOneToNine(grid.map((values) => values[row])), `column ${row + 1}`);
  }
  for (let boxRow = 0; boxRow < 9; boxRow += 3) {
    for (let boxCol = 0; boxCol < 9; boxCol += 3) {
      const values = [];
      for (let row = boxRow; row < boxRow + 3; row += 1) {
        for (let col = boxCol; col < boxCol + 3; col += 1) values.push(grid[row][col]);
      }
      assert.ok(hasDigitsOneToNine(values), `box ${boxRow / 3 + 1},${boxCol / 3 + 1}`);
    }
  }
  if (diagonal) {
    assert.ok(hasDigitsOneToNine(grid.map((row, index) => row[index])), 'main diagonal');
    assert.ok(hasDigitsOneToNine(grid.map((row, index) => row[8 - index])), 'anti diagonal');
  }
}

for (const mode of ['standard', 'diagonal']) {
  test(`${mode}: full grid obeys all selected rules`, () => {
    assertValidGrid(createSolvedGrid(mode), mode === 'diagonal');
  });

  for (const difficulty of ['easy', 'medium', 'hard']) {
    test(`${mode}/${difficulty}: generated puzzle has exactly one solution`, () => {
      const { puzzle, solution, clueCount } = generatePuzzle(difficulty, mode);
      assertValidGrid(solution, mode === 'diagonal');
      assert.equal(puzzle.flat().filter(Boolean).length, clueCount);
      assert.equal(countSolutions(puzzle, 2, mode), 1);
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
