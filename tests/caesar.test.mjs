// Scout Decode — 核心解碼（凱撒還原／反射／倒序）單元測試
// 直接由 index.html 抽出 CORE 段（CORE-BEGIN／CORE-END）做斷言，測嘅就係真正交付嘅代碼。
// 執行：node tests/caesar.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

function section(name) {
  const re = new RegExp('\\/\\* ' + name + '-BEGIN \\*\\/([\\s\\S]*?)\\/\\* ' + name + '-END \\*\\/');
  const m = html.match(re);
  if (!m) { throw new Error(name + ' section not found in index.html'); }
  return m[1];
}

const core = (function () {
  const ctx = vm.createContext({});
  vm.runInContext(section('CORE'), ctx);
  return ctx.ScoutDecodeCore;
})();

let passed = 0, failed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; failures.push(name + ' — ' + e.message); }
}
function eq(a, b, msg) {
  if (a !== b) { throw new Error((msg ? msg + '：' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
}
function ok(v, msg) { if (!v) { throw new Error(msg || 'expected truthy'); } }

t('normalizeUpper：小寫轉大寫，保留數字／空白', function () {
  eq(core.normalizeUpper('aBc 123'), 'ABC 123');
});
t('normalizeUpper：null／undefined 回空字串', function () {
  eq(core.normalizeUpper(null), '');
  eq(core.normalizeUpper(undefined), '');
});
t('shiftLetter：+3 位移', function () { eq(core.shiftLetter('A', 3), 'D'); });
t('shiftLetter：Z 過界包回 A', function () { eq(core.shiftLetter('Z', 1), 'A'); });
t('shiftLetter：負數位移', function () { eq(core.shiftLetter('M', -3), 'J'); });
t('caesar：KHOOR −3 = HELLO（README 固定範例）', function () { eq(core.caesar('KHOOR', 3), 'HELLO'); });
t('caesar：KHOOR ZRUOG VFRXW −3 = HELLO WORLD SCOUT', function () {
  eq(core.caesar('KHOOR ZRUOG VFRXW', 3), 'HELLO WORLD SCOUT');
});
t('caesar：ABC −23（≡+3）= DEF', function () { eq(core.caesar('ABC', 23), 'DEF'); });
t('caesar：ABC −3 = XYZ', function () { eq(core.caesar('ABC', 3), 'XYZ'); });
t('caesar：FGHIJ −5 = ABCDE（README 固定範例）', function () { eq(core.caesar('FGHIJ', 5), 'ABCDE'); });
t('caesar：N=0 原樣', function () { eq(core.caesar('ABC', 0), 'ABC'); });
t('caesar：只動 A–Z，數字／空白原樣保留', function () {
  eq(core.caesar('ABC def 123', 3), 'XYZ ABC 123');
});
t('caesar：空字串', function () { eq(core.caesar('', 5), ''); });
t('caesar：Z −25 = A（wrap）', function () { eq(core.caesar('Z', 25), 'A'); });
t('caesar：A −1 = Z（wrap）', function () { eq(core.caesar('A', 1), 'Z'); });
t('atbash：A↔Z', function () { eq(core.atbash('A'), 'Z'); });
t('atbash：HELLO = SVOOL', function () { eq(core.atbash('HELLO'), 'SVOOL'); });
t('atbash：非字母原樣保留', function () { eq(core.atbash('a b 1'), 'Z Y 1'); });
t('atbash：自反（做兩次＝原樣）', function () { eq(core.atbash(core.atbash('SCOUT')), 'SCOUT'); });
t('reverseText：ABC = CBA', function () { eq(core.reverseText('ABC'), 'CBA'); });
t('reverseText：空白一齊反轉', function () { eq(core.reverseText('AB CD'), 'DC BA'); });
t('reverseText：先轉大寫再反轉', function () { eq(core.reverseText('ab c'), 'C BA'); });
t('reverseText：空字串', function () { eq(core.reverseText(''), ''); });

console.log('caesar: ' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  failures.forEach(function (f) { console.log('  FAIL ' + f); });
  process.exit(1);
}
