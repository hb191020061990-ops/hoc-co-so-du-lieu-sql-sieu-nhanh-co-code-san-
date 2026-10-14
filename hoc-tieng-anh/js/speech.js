// Phát âm (Text-to-Speech) và nhận diện giọng nói của trình duyệt
import { state } from './store.js';

const synth = window.speechSynthesis;
let voices = [];
function loadVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export const canSpeak = () => Boolean(synth);

function pickVoice(lang) {
  if (!voices.length) loadVoices();
  const exact = voices.filter(v => v.lang.replace('_', '-') === lang);
  const en = voices.filter(v => v.lang.startsWith('en'));
  const pool = exact.length ? exact : en;
  // Ưu tiên giọng chất lượng cao nếu có
  return pool.find(v => /Google|Natural|Samantha|Daniel|Aria|Jenny|Guy|Serena/i.test(v.name)) || pool[0] || null;
}

/** Đọc một câu/từ tiếng Anh. Trả về Promise kết thúc khi đọc xong. */
export function speak(text, { rate, lang } = {}) {
  return new Promise(resolve => {
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || state.settings.accent || 'en-US';
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = rate || state.settings.rate || 0.9;
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
    // Một số trình duyệt không gọi onend – đặt hạn chót
    setTimeout(resolve, 1000 + text.length * 120);
  });
}

export const stopSpeaking = () => synth && synth.cancel();

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecognize = () => Boolean(Recognition);

/**
 * Nghe người học nói một lần. Trả về Promise<string[]> các cách nghe được (tối đa 5).
 * onState('listening' | 'done' | 'error', message)
 */
export function listen({ lang, onState } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('unsupported'));
    stopSpeaking();
    const rec = new Recognition();
    rec.lang = lang || state.settings.accent || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    let got = false;
    rec.onstart = () => onState?.('listening');
    rec.onresult = e => {
      got = true;
      const alts = [];
      for (const r of e.results) for (const a of r) alts.push(a.transcript);
      onState?.('done');
      resolve(alts);
    };
    rec.onerror = e => {
      onState?.('error', e.error);
      reject(new Error(e.error || 'error'));
    };
    rec.onend = () => { if (!got) { onState?.('done'); resolve([]); } };
    try { rec.start(); } catch (err) { reject(err); }
    listen.stop = () => { try { rec.stop(); } catch (e) { /* đã dừng */ } };
  });
}
