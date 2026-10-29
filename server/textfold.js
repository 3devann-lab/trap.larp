// Folds text so disguised spellings compare equal, for blocked words and handle locks.
// Catches fancy Unicode "fonts" (𝓫𝓪𝓭 𝐁𝐀𝐃 ｂａｄ ⓑⓐⓓ 🅑🅐🅓 ʙᴀᴅ), accents, capitals, look-alike
// letters from other alphabets (Cyrillic а, Greek ο), number/symbol swaps (b4d, $), letters
// split up by dots, dashes, emoji or invisible characters (b.a.d, b🔥a🔥d), and spaced-out
// letters (b a d). Real word gaps are kept, so "this hit" doesn't turn into "shit".

// Capitals that mean a different Latin letter than their lowercase form (Σ is an E in "ΣVΣ",
// but σ looks like an o).
const UPPER = { Σ: 'e', Π: 'n', Λ: 'a', Я: 'r', Ш: 'w', Ҡ: 'k', Ð: 'd', Ł: 'l' };

const LOOKALIKE = {
  // small capitals
  ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
  // Latin letters with strokes, hooks and ligatures that don't decompose
  ı: 'i', ȷ: 'j', ł: 'l', ø: 'o', đ: 'd', ð: 'd', ħ: 'h', ŧ: 't', ƀ: 'b', ɨ: 'i', ʉ: 'u', ß: 'ss', æ: 'ae', œ: 'oe', ɑ: 'a', ɡ: 'g', ɩ: 'i', ɵ: 'o', ƒ: 'f', ɓ: 'b', ɗ: 'd', ƈ: 'c', ɠ: 'g', ƙ: 'k', ɱ: 'm', ɲ: 'n', ƥ: 'p', ʠ: 'q', ɽ: 'r', ʂ: 's', ƭ: 't', ʋ: 'v', ƴ: 'y', ȥ: 'z', þ: 'p',
  // Cyrillic
  а: 'a', в: 'b', г: 'r', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', п: 'n', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', ш: 'w', щ: 'w', ъ: 'b', ь: 'b', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w', һ: 'h', ӏ: 'l', ү: 'y', ҫ: 'c', ԍ: 'g',
  // Greek
  α: 'a', β: 'b', γ: 'y', δ: 'd', ε: 'e', ϵ: 'e', ζ: 'z', η: 'n', θ: 'o', ι: 'i', κ: 'k', λ: 'a', μ: 'u', ν: 'v', ο: 'o', π: 'n', ρ: 'p', σ: 'o', ς: 'c', ϲ: 'c', τ: 't', υ: 'u', χ: 'x', ω: 'w', ϳ: 'j',
  // symbols used as letters (digits are handled when matching, since 1 can be an i or an l)
  '@': 'a', $: 's', '€': 'e', '¢': 'c', '+': 't', '!': '1', '|': '1',
};

// Letters in enclosed blocks that Unicode doesn't decompose: 🅐 (negative circled),
// 🅰 (negative squared) and 🇦 (regional indicators).
function enclosed(cp) {
  for (const start of [0x1f150, 0x1f170, 0x1f1e6]) if (cp >= start && cp < start + 26) return String.fromCharCode(97 + cp - start);
  return null;
}

// Text → list of plain [a-z0-9] words.
export function foldWords(text) {
  let out = '';
  for (const ch of String(text ?? '').normalize('NFKD')) {
    if (/\p{M}/u.test(ch)) continue; // accents and other combining marks
    const cp = ch.codePointAt(0);
    let c = enclosed(cp) ?? UPPER[ch] ?? ch.toLowerCase();
    c = LOOKALIKE[c] ?? c;
    if (/^[\s\p{Z}]$/u.test(c)) out += ' ';
    else out += c.replace(/[^a-z0-9]/g, '');
  }
  // "b a d" → "bad": runs of single letters are joined back into one word.
  const words = out.split(' ').filter(Boolean);
  const joined = [];
  for (const w of words) {
    if (w.length === 1 && joined.length && joined.at(-1).single) joined.at(-1).w += w;
    else joined.push({ w, single: w.length === 1 });
  }
  return joined.map((x) => x.w);
}

// Each keyword letter also matches its common number swap, and may repeat ("baaad").
const LEET = { a: 'a4', b: 'b8', e: 'e3', g: 'g9', i: 'i1', l: 'l1', o: 'o0', s: 's5', t: 't7', z: 'z2' };

// A keyword becomes a list of steps, one per letter. Words of a phrase may be written together
// or apart ("kill yourself", "killyourself"), so the first letter of each later word may come
// after a space.
function keywordSteps(keyword) {
  const words = foldWords(keyword);
  if (words.join('').length < 2) return null;
  return words.flatMap((w, wi) => [...w].map((c, ci) => ({ chars: LEET[c] || c, gap: wi > 0 && ci === 0 })));
}

// Walks the text once, tracking every partial match at the same time, so the time it takes
// grows with text length × keyword length. (A regular expression for this pattern can take
// minutes on a crafted comment.)
const AFTER_LETTER = 1;
const AFTER_SPACE = 2;
function found(steps, text) {
  const m = steps.length;
  let cur = new Uint8Array(m + 1);
  for (const c of text) {
    cur[0] = AFTER_LETTER; // a match can start anywhere
    const next = new Uint8Array(m + 1);
    for (let j = 0; j < m; j++) {
      if (!cur[j]) continue;
      if (cur[j] & AFTER_LETTER) {
        if (j > 0 && steps[j - 1].chars.includes(c)) next[j] |= AFTER_LETTER; // the same letter again
        if (c === ' ' && j > 0 && steps[j].gap) next[j] |= AFTER_SPACE;
      }
      if (cur[j] & AFTER_SPACE && c === ' ') next[j] |= AFTER_SPACE;
      if (steps[j].chars.includes(c)) next[j + 1] |= AFTER_LETTER;
    }
    if (next[m]) return true;
    cur = next;
  }
  return false;
}

// Returns a function that says whether some text contains any of the keywords. Keywords made
// only of emoji or symbols are matched as written (ignoring case and look-alike forms).
export function wordMatcher(keywords) {
  const patterns = [];
  const raw = [];
  for (const k of Array.isArray(keywords) ? keywords : []) {
    const steps = keywordSteps(k);
    if (steps) patterns.push(steps);
    else if (String(k).trim() && !foldWords(k).join('')) raw.push(String(k).trim().normalize('NFKC').toLowerCase());
  }
  return (text) => {
    if (!patterns.length && !raw.length) return false;
    const folded = foldWords(text).join(' ');
    if (patterns.some((steps) => found(steps, folded))) return true;
    const plain = String(text ?? '').normalize('NFKC').toLowerCase();
    return raw.some((r) => plain.includes(r));
  };
}

// The key a handle is locked under: folded, with number swaps read as letters and l/i as one,
// so @MIA, @m1a and @mia_ are the same handle.
const DIGIT_AS_LETTER = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
export const handleKey = (username) => foldWords(username).join('').replace(/[0-9]/g, (d) => DIGIT_AS_LETTER[d] ?? d).replace(/l/g, 'i');
