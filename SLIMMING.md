# 📦 防增肥守則（SLIMMING.md）

> 凡改版／加功能之前，請先由頭讀一次呢份。
> 目的：**Vercel 儲存空間唔爆、功能 100% 不變、絕不走回頭路。**

## 1. 專案係咩（每次都要記住）

- 呢個 App = **單一個 `index.html`**（inline CSS/JS，含全部功能）。
- **零依賴、零 build step、冇 `package.json`、冇 framework**。唔好為咗「跟潮流」加返。
- 上線結果只得 `index.html` 一個檔案；其餘（`tests/`、`README.md`、`SLIMMING.md`）係開發資產，唔上線。

## 2. Vercel 部署事實（零設定）

- Vercel 會自動偵測做 **靜態網站（framework = Other）**，直接 serve repo 根目錄。
- 輸出目錄 = 根目錄，**唔需要 `vercel.json`，亦唔需要設 `outputDirectory`**（冇 build 就冇「產物資料夾」）。
- `.vercelignore` 已寫明只上傳網頁產物。改呢個檔時逐項諗清：**呢個檔案係咪網頁會用？唔係就唔上傳。**
- 若他日真係引入 build 工具，先查 Vercel 官方文件，先好加 `vercel.json`／`outputDirectory`／build 命令；**唔准靠估**。

## 3. 硬性守則（防增肥鐵律）

1. **禁止加 runtime `dependencies`**：Tesseract、jQuery、框架……一律唔准入 `package.json`（根本冇呢個檔）。
   - 重引擎只可 **CDN 後載**，例如 OCR 用 `https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js` —— 要用先載入，唔用零成本。
2. **建造工具只准入 `devDependencies`**（要真係有 build 先用得著），唔好俾 Vercel 喺生產環境 cache 一大堆 runtime。
   - 現階段保持「零工具」先係最瘦。
3. **新增任何靜態檔（圖／字型／css／js）之前，先 grep** 查有冇喺 `index.html` 被引用；
   - **冇人引用 = 死重**，唔好 commit，或者即刻刪。
4. **唔准 commit 開發殘留**：`*.bak` `*.tmp` `*.old` `*.log` `*~` `.DS_Store`、測試上傳 `uploads/`。
   - `.gitignore` 已經冚晒；有新類型殘留就加 pattern。
5. **大檔門檻**：任何單檔 > 100 KB 之前，先停一停問：「係咪一定要？可唔可以壓縮／改 data URI／CDN 後載？」
   - 現時最大嘅 `index.html` 都係約 72 KB，冇必要破戒。
6. 圖片盡量 inline（data URI）或 SVG；高解像原圖／設計稿／截圖唔屬於呢個 repo。

## 4. 每次改版必跑（Checklist）

```bash
# 冇 npm 腳本（零依賴），直接跑三份測試 = 呢個項目嘅「check／build」：
node tests/caesar.test.mjs    # 凱撒／反射／倒序（23 項）
node tests/cv.test.mjs        # 拍照辨識核心（22 項）
node tests/tools.test.mjs     # 查表工具（31 項）
# 三份都出「0 failed」先算過（合共 76 項）。
```

- 之後跑 `find . -path ./.git -prune -o -type f` 睇清楚有冇生咗殘留／大檔。
- 有改動就 `git status`＋睇 diff 先 commit，防止手多帶大檔入庫。

## 5. OCR 引擎嘅緊箍咒

- 版本**釘死 `@5.1.1`**（v5 最後一版，UMD 全包、結果可重現）。**唔好浮動 `@5`**。
- v5 之後（v6/v7）係 **ESM**，普通 `<script>` 標籤引用會冇咗全域 `Tesseract`；要升級就必須同時改接入程式碼。
- 現行用 `Tesseract.recognize(...)` 喺 v5 已標 **deprecated**（內部自己 create+destroy worker）。
  - 第日升級先改做 `createWorker('eng') → worker.recognize(...) → worker.terminate()`。
- 引擎完全 **CDN on-demand**：唔用 OCR 就唔會 download。升級只為「重現性＋快取」，唔係為咗新功能。

## 6. 已修紀錄／已知事項

- **v2.3 已修**：
  - OCR CDN 由浮動 `@5` 釘死做 `5.1.1`（重現性、快取友好）。
  - 拍照載入改尊重手機 EXIF 旋轉（`createImageBitmap('from-image')`）；唔支援嘅瀏覽器自動退回原本 `<img>` 載入，行為同舊版一致。
- **已知但唔改（by design）**：真人旗號／人像姿態辨識唔做；DECODE 只做解碼、唔加密。

## 7. 一句總結

> **單檔、零依賴、CDN 後載、只上傳 index.html、改嘢先跑測試** —— 每次都係咁，就唔會肥返。
