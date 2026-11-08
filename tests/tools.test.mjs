// Scout Decode — 查表工具（座標 Grid／電話 T9／NATO 拼音）單元測試
// 由 index.html 抽出 TOOLS-CORE 段（TOOLS-CORE-BEGIN／TOOLS-CORE-END）做斷言，
// 確保與 Scout System CODE App 嘅規則對齊。
// 執行：node tests/tools.test.mjs
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

const tools = (function () {
  const ctx = vm.createContext({});
  vm.runInContext(section('TOOLS-CORE'), ctx);
  return ctx.ScoutDecodeTools;
})();

let passed = 0, failed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; failures.push(name + ' — ' + e.message); }
}
function eq(a, b, msg) {
  if (a !== b) { throw new Error((msg ? msg + '：' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
}

/* ---------- 座標 Grid ---------- */
t('normalizeGridKey：小寫轉大寫', function () { eq(tools.normalizeGridKey('scout'), 'SCOUT'); });
t('normalizeGridKey：空 KEY 預設 SCOUT', function () { eq(tools.normalizeGridKey(''), 'SCOUT'); });
t('normalizeGridKey：短 KEY 補 SCOUT 尾', function () { eq(tools.normalizeGridKey('ab12'), 'ABSCO'); });
t('normalizeGridKey：5 個字母原樣', function () { eq(tools.normalizeGridKey('ABCDE'), 'ABCDE'); });
t('decodeGridPair：SS = A（KEY=SCOUT）', function () { eq(tools.decodeGridPair('SS', 'SCOUT'), 'A'); });
t('decodeGridPair：CS = B（KEY=SCOUT）', function () { eq(tools.decodeGridPair('CS', 'SCOUT'), 'B'); });
t('decodeGridPair：TT = Z（DECODE 預埋 Z 格）', function () { eq(tools.decodeGridPair('TT', 'SCOUT'), 'Z'); });
t('decodeGridPair：J 唔喺 KEY → null', function () { eq(tools.decodeGridPair('SJ', 'SCOUT'), null); });
t('decodeGridPair：Z 唔喺 KEY → null', function () { eq(tools.decodeGridPair('ZT', 'SCOUT'), null); });
t('decodeGridText：SS CS = AB（README 固定範例）', function () { eq(tools.decodeGridText('SS CS', 'SCOUT'), 'AB'); });
t('decodeGridText：單字母原樣保留（CODE 編 J/Z 時會留低）', function () { eq(tools.decodeGridText('J', 'SCOUT'), 'J'); });
t('decodeGridText：/ 分詞', function () { eq(tools.decodeGridText('SS / CS', 'SCOUT'), 'A B'); });
t('decodeGridText：解唔到 → ?', function () { eq(tools.decodeGridText('AA SS', 'SCOUT'), '?A'); });
t('decodeGridText：空字串', function () { eq(tools.decodeGridText('', 'SCOUT'), ''); });
t('decodeGridText：4 字元 token 唔拆 pair → ?', function () { eq(tools.decodeGridText('SSCS', 'SCOUT'), '?'); });

/* ---------- 電話 T9 ---------- */
t('PHONE_GROUPS：2/7/9 分組', function () {
  eq(tools.PHONE_GROUPS['2'], 'ABC');
  eq(tools.PHONE_GROUPS['7'], 'PQRS');
  eq(tools.PHONE_GROUPS['9'], 'WXYZ');
});
t('decodePhoneToken：21 = A', function () { eq(tools.decodePhoneToken('21'), 'A'); });
t('decodePhoneToken：22 = B', function () { eq(tools.decodePhoneToken('22'), 'B'); });
t('decodePhoneToken：24 唔存在 → ?', function () { eq(tools.decodePhoneToken('24'), '?'); });
t('decodePhoneToken：74 = S', function () { eq(tools.decodePhoneToken('74'), 'S'); });
t('decodePhoneToken：94 = Z', function () { eq(tools.decodePhoneToken('94'), 'Z'); });
t('decodePhoneToken：/ = 詞間', function () { eq(tools.decodePhoneToken('/'), ' '); });
t('decodePhoneToken：單數字 5 唔係 pair → ?', function () { eq(tools.decodePhoneToken('5'), '?'); });
t('decodePhoneText：22 43 33 = BIF', function () { eq(tools.decodePhoneText('22 43 33'), 'BIF'); });
t('decodePhoneText：91 / 74 94 = W SZ（/ 先分詞）', function () { eq(tools.decodePhoneText('91 / 74 94'), 'W SZ'); });

/* ---------- NATO 拼音 ---------- */
t('decodeNatoText：ALPHA BRAVO CHARLIE = ABC', function () {
  eq(tools.decodeNatoText('ALPHA BRAVO CHARLIE'), 'ABC');
});
t('decodeNatoText：JULIETT／JULIET 雙寫都收', function () {
  eq(tools.decodeNatoText('JULIETT JULIET ALFA'), 'JJA');
});
t('decodeNatoText：數字原樣保留', function () { eq(tools.decodeNatoText('ALPHA 123'), 'A 123'); });
t('decodeNatoText：唔認得嘅字留低（加空格隔開）', function () {
  eq(tools.decodeNatoText('ALPHA ZEBRA'), 'A ZEBRA');
});
t('decodeNatoWord：小寫 xray = X', function () { eq(tools.decodeNatoWord('xray'), 'X'); });
t('decodeNatoWord：唔認得 → null', function () { eq(tools.decodeNatoWord('SCOUT'), null); });

console.log('tools: ' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  failures.forEach(function (f) { console.log('  FAIL ' + f); });
  process.exit(1);
}
