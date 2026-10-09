# 九格日常 — 數獨 Sudoku

一款以原生 HTML、CSS 與 JavaScript 製作的響應式數獨遊戲，無需安裝第三方套件或啟動後端。提供標準數獨、對角線數獨（X-Sudoku）及鋸齒數獨（Jigsaw Sudoku）三種模式；題目依所選規則驗證唯一解。

## 本機啟動

在此資料夾執行：

```sh
python3 -m http.server 3000
```

瀏覽器開啟 `http://localhost:3000`。

## 遊戲操作

在棋盤上方選擇模式與簡單／中等／困難難度；切換模式或難度會開始新局。標準模式使用 3×3 宮格；X-Sudoku 在行、列、宮格規則外，另要求兩條大對角線各自包含 1–9 且不得重複；Jigsaw Sudoku 以 9 個正交連通、各含 9 格的異形區域取代標準宮格。點選空格後，以鍵盤 `1`–`9` 或棋盤下方數字列填數；`← ↑ → ↓` 移動選取格；`N` 切換候選數字筆記；`H` 顯示一格答案；`Backspace` 或 `Delete` 清除。另提供撤銷、暫停、重新開始、新局、即時錯誤提示與格子高亮設定；第三次錯誤輸入會結束當前局。

## 執行核心測試

使用 Node.js 內建測試器（不需額外套件）：

```sh
node --test test-sudoku.js
```

測試涵蓋三種模式、各模式三種難度下題目的唯一解、X-Sudoku 對角線規則，以及 Jigsaw 各區域連通性、區域大小和區域數字規則。

## 專案檔案

- `index.html`：中文遊戲頁、模式／難度控制與無障礙標記。
- `styles.css`：響應式版型、X-Sudoku 對角線提示、Jigsaw 異形區域邊界與高亮。
- `sudoku.js`：三種規則下的盤面生成、區域映射、解數驗證與唯一解題目生成。
- `app.js`：棋盤、模式、區域高亮、輸入、計時、設定與遊戲狀態。
- `test-sudoku.js`：Node 內建核心回歸測試。
- `manus-routes.json`：正式網站頁面路由宣告。
- `dist/`：靜態發佈內容。

## Cloudflare Pages 自動部署

此 repository 的 `main` 分支已連接至 Cloudflare Pages 專案 `sudoku-game-auto`。每次推送至 `main` 都會自動建置並部署；建置命令會確認 `dist/index.html` 存在，並發布 `dist/` 靜態輸出。
