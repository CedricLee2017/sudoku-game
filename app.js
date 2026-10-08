(function () {
  'use strict';

  const { generatePuzzle } = window.SudokuEngine;
  const $ = (selector) => document.querySelector(selector);
  const boardEl = $('#board');
  const cells = [];
  const MAX_MISTAKES = 3;
  const difficultyLabels = { easy: '簡單', medium: '中等', hard: '困難' };

  const state = {
    difficulty: 'medium',
    puzzle: [],
    solution: [],
    values: [],
    notes: [],
    selected: 40,
    notesMode: false,
    checkErrors: true,
    highlight: true,
    errors: 0,
    elapsedSeconds: 0,
    startedAt: Date.now(),
    paused: false,
    failed: false,
    completed: false,
    history: []
  };

  function makeCell(index) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'gridcell');
    cell.tabIndex = index === state.selected ? 0 : -1;
    cell.setAttribute('aria-label', `第 ${Math.floor(index / 9) + 1} 行，第 ${index % 9 + 1} 列，空格`);
    boardEl.appendChild(cell);
    cells.push(cell);
  }

  function saveHistory() {
    state.history.push({
      values: state.values.slice(),
      notes: state.notes.map((noteSet) => [...noteSet]),
      errors: state.errors,
      failed: state.failed,
      completed: state.completed
    });
    if (state.history.length > 60) state.history.shift();
    $('#undo-button').disabled = false;
  }

  function renderBoard() {
    if (cells.length !== 81) return;
    const activeBoard = boardEl.contains(document.activeElement);
    const selectedValue = state.values[state.selected];
    const selectedRow = Math.floor(state.selected / 9);
    const selectedCol = state.selected % 9;
    const selectedBoxRow = Math.floor(selectedRow / 3);
    const selectedBoxCol = Math.floor(selectedCol / 3);

    cells.forEach((cell, index) => {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const boxRow = Math.floor(row / 3);
      const boxCol = Math.floor(col / 3);
      const value = state.values[index];
      const given = state.puzzle[index] !== 0;
      const wrong = Boolean(value && !given && value !== state.solution[index]);
      cell.className = 'cell';
      if (given) cell.classList.add('given');
      if (value && !given) cell.classList.add('filled');
      const peers = state.highlight && index !== state.selected &&
        (row === selectedRow || col === selectedCol || (boxRow === selectedBoxRow && boxCol === selectedBoxCol));
      if (peers) cell.classList.add('peer');
      if (state.highlight && selectedValue && value === selectedValue && index !== state.selected) cell.classList.add('same-number');
      if (index === state.selected) cell.classList.add('selected');
      if (wrong && state.checkErrors) cell.classList.add('wrong');
      cell.disabled = state.paused || state.failed || state.completed;
      cell.tabIndex = index === state.selected ? 0 : -1;
      cell.setAttribute('aria-invalid', wrong && state.checkErrors ? 'true' : 'false');

      if (value) {
        cell.textContent = String(value);
        const labels = [`第 ${row + 1} 行，第 ${col + 1} 列`, given ? '題目數字' : '你填寫的數字', String(value)];
        if (wrong && state.checkErrors) labels.push('錯誤');
        cell.setAttribute('aria-label', labels.join('，'));
      } else {
        cell.setAttribute('aria-label', `第 ${row + 1} 行，第 ${col + 1} 列，空格${index === state.selected ? '，已選取' : ''}`);
        const notes = state.notes[index];
        if (notes.size) {
          const noteGrid = document.createElement('span');
          noteGrid.className = 'pencil-grid';
          noteGrid.setAttribute('aria-label', `筆記：${[...notes].sort().join('、')}`);
          for (let digit = 1; digit <= 9; digit += 1) {
            const note = document.createElement('span');
            note.textContent = notes.has(digit) ? String(digit) : '';
            noteGrid.appendChild(note);
          }
          cell.appendChild(noteGrid);
        } else {
          cell.textContent = '';
        }
      }
    });

    $('#undo-button').disabled = state.history.length === 0;
    $('#pause-overlay').hidden = !state.paused;
    $('#pause-button').textContent = state.paused ? '繼續' : '暫停';
    updateStatus();
    if (activeBoard) {
      const focusedCell = cells[state.selected];
      requestAnimationFrame(() => focusedCell.focus({ preventScroll: true }));
    }
  }

  function updateStatus() {
    $('#mistakes-count').innerHTML = `${state.errors} <small>/ ${MAX_MISTAKES}</small>`;
    $('#mistake-dots').querySelectorAll('i').forEach((dot, index) => dot.classList.toggle('active', index < state.errors));
    $('#notes-button').setAttribute('aria-pressed', String(state.notesMode));
    $('#notes-state').textContent = state.notesMode ? '開啟' : '關閉';
    $('#error-setting').checked = state.checkErrors;
    $('#highlight-setting').checked = state.highlight;
    const statusLabel = $('#status-label');
    const liveIndicator = $('.live-indicator');
    if (state.failed) {
      statusLabel.textContent = '本局結束';
      liveIndicator.style.background = '#c85048';
    } else if (state.completed) {
      statusLabel.textContent = '完成了';
      liveIndicator.style.background = '#6b9a72';
    } else if (state.paused) {
      statusLabel.textContent = '暫停中';
      liveIndicator.style.background = '#d6a85b';
    } else {
      statusLabel.textContent = `進行中 · ${difficultyLabels[state.difficulty]}`;
      liveIndicator.style.background = '#6b9a72';
    }
  }

  function elapsedNow() {
    return state.paused || state.failed || state.completed
      ? state.elapsedSeconds
      : Math.floor((Date.now() - state.startedAt) / 1000);
  }

  function updateTimer() {
    const total = elapsedNow();
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    $('#timer').textContent = `${minutes}:${seconds}`;
  }

  function setMessage(text, kind = '') {
    const message = $('#game-message');
    message.textContent = text;
    message.className = `game-message${kind ? ` ${kind}` : ''}`;
  }

  function gameIsActive() {
    return !state.paused && !state.failed && !state.completed;
  }

  function maybeFinish() {
    if (state.values.some((value, index) => value !== state.solution[index])) return;
    const finalElapsed = elapsedNow();
    state.completed = true;
    state.elapsedSeconds = finalElapsed;
    const minutes = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
    const seconds = String(state.elapsedSeconds % 60).padStart(2, '0');
    setMessage(`完成了！這次花了 ${minutes}:${seconds}。好好享受這一刻。`, 'success');
  }

  function enterNumber(number) {
    if (!gameIsActive()) return;
    const index = state.selected;
    if (!indexIsEditable(index)) return;

    if (state.notesMode) {
      if (state.values[index]) return;
      saveHistory();
      if (state.notes[index].has(number)) state.notes[index].delete(number);
      else state.notes[index].add(number);
      renderBoard();
      return;
    }

    if (state.values[index] === number) return;
    saveHistory();
    state.values[index] = number;
    state.notes[index].clear();
    if (number !== state.solution[index]) {
      state.errors += 1;
      if (state.checkErrors) setMessage('這個數字不太對，試試其他可能吧。', 'error');
      else setMessage('已記下這次填寫。你可以在設定中開啟即時提示。');
      if (state.errors >= MAX_MISTAKES) {
        const finalElapsed = elapsedNow();
        state.failed = true;
        state.elapsedSeconds = finalElapsed;
        setMessage('本局錯誤已達 3 次，先休息一下，或重新開始。', 'error');
      }
    } else {
      setMessage('很好，這一格正確。');
    }
    maybeFinish();
    renderBoard();
  }

  function indexIsEditable(index) {
    return state.puzzle[index] === 0;
  }

  function clearSelected() {
    if (!gameIsActive() || !indexIsEditable(state.selected)) return;
    const index = state.selected;
    if (!state.values[index] && state.notes[index].size === 0) return;
    saveHistory();
    state.values[index] = 0;
    state.notes[index].clear();
    setMessage('已清除所選格子。');
    renderBoard();
  }

  function selectCell(index) {
    if (index < 0 || index > 80) return;
    state.selected = index;
    renderBoard();
  }

  function moveSelection(key) {
    const row = Math.floor(state.selected / 9);
    const col = state.selected % 9;
    let nextRow = row;
    let nextCol = col;
    if (key === 'ArrowUp') nextRow = (row + 8) % 9;
    if (key === 'ArrowDown') nextRow = (row + 1) % 9;
    if (key === 'ArrowLeft') nextCol = (col + 8) % 9;
    if (key === 'ArrowRight') nextCol = (col + 1) % 9;
    selectCell(nextRow * 9 + nextCol);
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return;
    state.values = previous.values;
    state.notes = previous.notes.map((noteList) => new Set(noteList));
    state.errors = previous.errors;
    state.failed = previous.failed;
    state.completed = previous.completed;
    if (!state.paused && !state.failed && !state.completed) state.startedAt = Date.now() - state.elapsedSeconds * 1000;
    setMessage('已還原上一步。');
    renderBoard();
    updateTimer();
  }

  function giveHint() {
    if (!gameIsActive()) return;
    let target = indexIsEditable(state.selected) && state.values[state.selected] !== state.solution[state.selected]
      ? state.selected
      : -1;
    if (target < 0) target = state.values.findIndex((value, index) => indexIsEditable(index) && value !== state.solution[index]);
    if (target < 0) return;
    saveHistory();
    state.selected = target;
    state.values[target] = state.solution[target];
    state.notes[target].clear();
    setMessage('提示已填入一個正確數字。');
    maybeFinish();
    renderBoard();
  }

  function toggleNotes() {
    state.notesMode = !state.notesMode;
    setMessage(state.notesMode ? '筆記模式已開啟，可以記錄候選數字。' : '筆記模式已關閉。');
    renderBoard();
  }

  function restartGame() {
    state.values = state.puzzle.flat();
    state.notes = Array.from({ length: 81 }, () => new Set());
    state.errors = 0;
    state.elapsedSeconds = 0;
    state.startedAt = Date.now();
    state.paused = false;
    state.failed = false;
    state.completed = false;
    state.notesMode = false;
    state.history = [];
    state.selected = state.puzzle.findIndex((value) => value === 0);
    setMessage('棋盤已重設，從容開始吧。');
    updateTimer();
    renderBoard();
  }

  function newGame() {
    state.difficulty = $('#difficulty').value;
    $('#new-game-button').disabled = true;
    $('#new-game-button').innerHTML = '<span aria-hidden="true">…</span> 準備中';
    setMessage('正在準備一盤全新的數獨…');
    window.setTimeout(() => {
      const generated = generatePuzzle(state.difficulty);
      state.puzzle = generated.puzzle.flat();
      state.solution = generated.solution.flat();
      state.values = state.puzzle.slice();
      state.notes = Array.from({ length: 81 }, () => new Set());
      state.errors = 0;
      state.elapsedSeconds = 0;
      state.startedAt = Date.now();
      state.paused = false;
      state.failed = false;
      state.completed = false;
      state.notesMode = false;
      state.history = [];
      state.selected = state.puzzle.findIndex((value) => value === 0);
      const clueText = generated.clueCount;
      setMessage(`${difficultyLabels[state.difficulty]}難度已就緒 · ${clueText} 個提示數字。`);
      updateTimer();
      renderBoard();
      $('#new-game-button').disabled = false;
      $('#new-game-button').innerHTML = '<span aria-hidden="true">＋</span> 新局';
    }, 30);
  }

  function togglePause() {
    if (state.failed || state.completed) return;
    if (state.paused) {
      state.paused = false;
      state.startedAt = Date.now() - state.elapsedSeconds * 1000;
      setMessage('歡迎回來，繼續解題。');
    } else {
      state.elapsedSeconds = elapsedNow();
      state.paused = true;
      setMessage('已暫停，計時器已停下。');
    }
    updateTimer();
    renderBoard();
  }

  function toggleDialog(open) {
    const dialog = $('#help-dialog');
    dialog.hidden = !open;
    if (open) $('#close-help-button').focus();
    else $('#help-button').focus();
  }

  for (let index = 0; index < 81; index += 1) makeCell(index);

  boardEl.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (cell) selectCell(Number(cell.dataset.index));
  });
  document.querySelectorAll('[data-number]').forEach((button) => {
    button.addEventListener('click', () => enterNumber(Number(button.dataset.number)));
  });
  $('#erase-button').addEventListener('click', clearSelected);
  $('#undo-button').addEventListener('click', undo);
  $('#hint-button').addEventListener('click', giveHint);
  $('#notes-button').addEventListener('click', toggleNotes);
  $('#restart-button').addEventListener('click', restartGame);
  $('#new-game-button').addEventListener('click', newGame);
  $('#difficulty').addEventListener('change', newGame);
  $('#pause-button').addEventListener('click', togglePause);
  $('#error-setting').addEventListener('change', (event) => {
    state.checkErrors = event.target.checked;
    if (!state.checkErrors) setMessage('即時錯誤提示已關閉；錯誤次數仍會累計。');
    renderBoard();
  });
  $('#highlight-setting').addEventListener('change', (event) => {
    state.highlight = event.target.checked;
    renderBoard();
  });
  $('#help-button').addEventListener('click', () => toggleDialog(true));
  $('#close-help-button').addEventListener('click', () => toggleDialog(false));
  $('#got-it-button').addEventListener('click', () => toggleDialog(false));
  $('#help-dialog').addEventListener('click', (event) => {
    if (event.target === $('#help-dialog')) toggleDialog(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!$('#help-dialog').hidden) {
      if (event.key === 'Escape') toggleDialog(false);
      return;
    }
    if (event.target.matches('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveSelection(event.key);
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      enterNumber(Number(event.key));
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      clearSelected();
      return;
    }
    if (event.key.toLowerCase() === 'n' && !event.repeat) toggleNotes();
    if (event.key.toLowerCase() === 'h' && !event.repeat) giveHint();
  });

  window.setInterval(updateTimer, 250);
  newGame();
})();
