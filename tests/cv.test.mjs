// Scout Decode — 拍照辨識核心（CV）單元測試
// 由 index.html 抽出 CV-CORE 段（CV-CORE-BEGIN／CV-CORE-END）做斷言。
// 摩斯／點字測試用程式合成嘅印刷影像做端到端斷言。
// 執行：node tests/cv.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', (process.env.SCOUT_TEST_HTML || 'index.html')), 'utf8');

function section(name) {
  const re = new RegExp('\\/\\* ' + name + '-BEGIN \\*\\/([\\s\\S]*?)\\/\\* ' + name + '-END \\*\\/');
  const m = html.match(re);
  if (!m) { throw new Error(name + ' section not found in index.html'); }
  return m[1];
}

const cv = (function () {
  const ctx = vm.createContext({});
  vm.runInContext(section('CV-CORE'), ctx);
  return ctx.ScoutDecodeCV;
})();

let passed = 0, failed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; failures.push(name + ' — ' + e.message); }
}
function eq(a, b, msg) {
  if (a !== b) { throw new Error((msg ? msg + '：' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
}
function eqArr(a, b, msg) {
  a = Array.from(a);
  const okArr = a.length === b.length && a.every(function (v, i) { return v === b[i]; });
  if (!okArr) { throw new Error((msg ? msg + '：' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
}
function ok(v, msg) { if (!v) { throw new Error(msg || 'expected truthy'); } }

/* ---------- 合成影像工具（白底 255、墨 0） ---------- */
function blank(w, h, v) { const g = new Uint8Array(w * h); for (let i = 0; i < g.length; i++) g[i] = v; return g; }
function rect(g, w, x, y, rw, rh) {
  for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) g[j * w + i] = 0;
}
function disc(g, w, cx, cy, r) {
  for (let j = cy - r; j <= cy + r; j++) {
    for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= w) { continue; }
      const dx = i - cx, dy = j - cy;
      if (dx * dx + dy * dy <= r * r) { g[j * w + i] = 0; }
    }
  }
}
/* 畫一行摩斯：symbols=['.','-']；gaps=相鄰間距 px；點 12×12、橫 40×12 */
function morseLine(w, h, symbols, gaps) {
  const g = blank(w, h, 255);
  let x = 20;
  for (let i = 0; i < symbols.length; i++) {
    const wd = symbols[i] === '-' ? 40 : 12;
    rect(g, w, x, 70, wd, 12);
    x += wd + (gaps[i] || 0);
  }
  return g;
}

/* ---------- 基礎影像處理 ---------- */
t('otsu：雙峰分佈，門檻落喺兩峰之間', function () {
  const g = new Uint8Array(256);
  for (let i = 0; i < 128; i++) g[i] = 50;
  for (let i = 128; i < 256; i++) g[i] = 200;
  const thr = cv.otsuThreshold(g);
  ok(thr > 50 && thr < 200, 'thr=' + thr);
});
t('isInkLight：白底黑字 → false', function () {
  const g = new Uint8Array(110).fill(255);
  for (let i = 0; i < 10; i++) g[i] = 0;
  eq(cv.isInkLight(g, 128), false);
});
t('isInkLight：黑底白字 → true', function () {
  const g = new Uint8Array(110).fill(0);
  for (let i = 100; i < 110; i++) g[i] = 255;
  eq(cv.isInkLight(g, 128), true);
});
t('binarize：兩種極性都正確', function () {
  const g = new Uint8Array([10, 200]);
  eqArr(cv.binarize(g, 100, false), [1, 0]);
  eqArr(cv.binarize(g, 100, true), [0, 1]);
});
t('connectedComponents：兩塊分離 → 兩個元件（面積／外框正確）', function () {
  const bin = new Uint8Array(25);
  bin[0] = bin[1] = bin[5] = bin[6] = 1;        // 左上 2×2
  bin[18] = bin[19] = bin[23] = bin[24] = 1;    // 右下 2×2（離斜角都夠遠）
  const comps = cv.connectedComponents(bin, 5, 5);
  eq(comps.length, 2);
  const a = comps.find(function (c) { return c.x0 === 0; });
  const b = comps.find(function (c) { return c.x0 === 3; });
  eq(a.area, 4); eq(a.x0, 0); eq(a.y0, 0); eq(a.x1, 1); eq(a.y1, 1);
  eq(b.area, 4); eq(b.x1, 4); eq(b.y0, 3); eq(b.y1, 4);
});
t('median：奇數／偶數／空', function () {
  eq(cv.median([3, 1, 2]), 2);
  eq(cv.median([1, 2, 3, 4]), 3);
  eq(cv.median([]), 0);
});

/* ---------- 摩斯 ---------- */
t('MORSE_REVERSE：標準對照', function () {
  eq(cv.MORSE_REVERSE['.'], 'E');
  eq(cv.MORSE_REVERSE['---'], 'O');
  eq(cv.MORSE_REVERSE['-..-'], 'X');
  eq(cv.MORSE_REVERSE['-----'], '0');
});
t('decodeMorseRaw：... --- ... = SOS', function () {
  eq(cv.decodeMorseRaw('... --- ...'), 'SOS');
});
t('decodeMorseRaw：.... . .-.. .-.. --- = HELLO', function () {
  eq(cv.decodeMorseRaw('.... . .-.. .-.. ---'), 'HELLO');
});
t('decodeMorseRaw：唔認得嘅組合 → ?；空 → 空', function () {
  eq(cv.decodeMorseRaw('...?'), '?');
  eq(cv.decodeMorseRaw(''), '');
});
t('recognizeMorse：合成 SOS 印刷影像端到端', function () {
  const g = morseLine(460, 160, ['.','.','.','-','-','-','.','.','.'], [12,12,72,12,12,72,12,12]);
  const r = cv.recognizeMorse(g, 460, 160);
  eq(r.raw, '... / --- / ...');
  eq(r.text, 'S O S'); /* decodeMorseRaw：/ 分詞 → 詞間加空格 */
  ok(r.conf > 0.9, 'conf=' + r.conf);
});
t('recognizeMorse：合成 HI 印刷影像（字母間距推斷）', function () {
  const g = morseLine(300, 160, ['.','.','.','.','.','.'], [12,12,12,36,12]);
  const r = cv.recognizeMorse(g, 300, 160);
  eq(r.raw, '.... ..');
  eq(r.text, 'HI');
});
t('recognizeMorse：空白影像 → 有警告、冇文字', function () {
  const r = cv.recognizeMorse(blank(200, 100, 255), 200, 100);
  eq(r.text, '');
  ok(r.warnings.length >= 1);
});

/* ---------- 印刷點字 ---------- */
t('recognizeBraille：合成 C（點 1,4）', function () {
  const w = 300, h = 300;
  const g = blank(w, h, 255);
  disc(g, w, 100, 100, 10); disc(g, w, 140, 100, 10);
  const r = cv.recognizeBraille(g, w, h);
  eq(r.text, 'C');
  ok(r.conf > 0.9, 'conf=' + r.conf);
});
t('recognizeBraille：合成 AB（兩細胞同排，左至右）', function () {
  const w = 300, h = 300;
  const g = blank(w, h, 255);
  disc(g, w, 60, 100, 10);    // A = 1
  disc(g, w, 130, 100, 10);   // B = 1,2
  disc(g, w, 130, 134, 10);
  const r = cv.recognizeBraille(g, w, h);
  eq(r.text, 'AB');
});
t('recognizeBraille：空白影像 → 有警告', function () {
  const r = cv.recognizeBraille(blank(200, 200, 255), 200, 200);
  eq(r.text, '');
  ok(r.warnings.length >= 1);
});

/* ---------- 朱高切符號 ---------- */
t('findSymbols：兩個分離方框 → 兩個符號（左至右）', function () {
  const w = 400, h = 200;
  const g = blank(w, h, 255);
  rect(g, w, 50, 50, 30, 30);
  rect(g, w, 200, 50, 30, 30);
  const boxes = cv.findSymbols(g, w, h);
  eq(boxes.length, 2);
  eq(boxes[0].x0, 50);
  eq(boxes[1].x0, 200);
});
t('findSymbols：貼近筆畫合併成一個符號', function () {
  const w = 400, h = 200;
  const g = blank(w, h, 255);
  rect(g, w, 50, 50, 15, 15);
  rect(g, w, 66, 50, 15, 15);
  eq(cv.findSymbols(g, w, h).length, 1);
});

/* ---------- 旗號 Semaphore ---------- */
t('angNorm／angDiff：角度規範化', function () {
  eq(cv.angNorm(390), 30);
  eq(cv.angNorm(-90), 270);
  eq(cv.angDiff(10, 350), 20);
  eq(cv.angDiff(0, 180), 180);
});
t('semLookup：精確角度對照表（同 CODE SEM_ANGLES）', function () {
  eq(cv.semLookup(180, 225).letter, 'A');
  eq(cv.semLookup(180, 0).letter, 'D');
  eq(cv.semLookup(270, 45).letter, 'Q');
});
t('semCandidates：±10° 噪聲仍然選中正確字母', function () {
  eq(cv.semCandidates(175, 235)[0].letter, 'A');
  eq(cv.semCandidates(185, 260)[0].letter, 'B');
  eq(cv.semCandidates(305, 5)[0].letter, 'T');
});

/* ---------- 朱高對照表資料 ---------- */
t('pigpenData：A 冇圓點；J 有圓點；W 圓點喺上；Z 圓點喺左', function () {
  eq(cv.pigpenData('A').dot, false);
  eq(cv.pigpenData('J').dot, true);
  eq(cv.pigpenData('W').dot, true);
  eq(cv.pigpenData('W').dp.y, 15);
  eq(cv.pigpenData('Z').dp.x, 15);
});

console.log('cv: ' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  failures.forEach(function (f) { console.log('  FAIL ' + f); });
  process.exit(1);
}
