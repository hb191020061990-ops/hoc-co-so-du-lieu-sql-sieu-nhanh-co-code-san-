#!/usr/bin/env python3
"""Tạo data/words.json từ các file nguồn data-src/*.txt.

Định dạng file nguồn (mỗi file là một cấp độ):

    # A1                                   <- dòng đầu: mã cấp độ
    @ greetings | Chào hỏi | 👋            <- bắt đầu chủ đề: mã | tên tiếng Việt | biểu tượng
    hello|int|xin chào|👋|Hello, my name is Lan.|Xin chào, tôi tên là Lan.

Các cột của một dòng từ: từ | loại từ | nghĩa | emoji (có thể bỏ trống) |
câu ví dụ | dịch câu ví dụ | phiên âm (tùy chọn, ghi đè phiên âm tự động).

Phiên âm được tạo tự động từ từ điển CMU (giấy phép BSD) nếu truyền --cmudict.
Không có từ điển thì giữ phiên âm cũ trong data/words.json.

Cách chạy:  python3 tools/build_data.py [--cmudict đường/dẫn/cmudict.dict]
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data-src"
OUT = ROOT / "data" / "words.json"

LEVELS = ["A1", "A2", "B1", "B2"]
POS = {"n", "v", "adj", "adv", "prep", "pron", "conj", "det", "num", "int", "phr", "modal"}

VOWELS = {
    "AA": "ɑː", "AE": "æ", "AO": "ɔː", "AW": "aʊ", "AY": "aɪ", "EH": "e", "EY": "eɪ",
    "IH": "ɪ", "IY": "iː", "OW": "oʊ", "OY": "ɔɪ", "UH": "ʊ", "UW": "uː",
}
CONS = {
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h", "JH": "dʒ",
    "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ", "P": "p", "R": "r", "S": "s",
    "SH": "ʃ", "T": "t", "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}
# Các cụm phụ âm đầu hợp lệ trong tiếng Anh, dùng để đặt dấu nhấn âm đúng chỗ.
ONSETS = {
    ("P", "L"), ("P", "R"), ("B", "L"), ("B", "R"), ("T", "R"), ("D", "R"), ("K", "L"),
    ("K", "R"), ("G", "L"), ("G", "R"), ("F", "L"), ("F", "R"), ("TH", "R"), ("SH", "R"),
    ("S", "P"), ("S", "T"), ("S", "K"), ("S", "M"), ("S", "N"), ("S", "L"), ("S", "W"),
    ("K", "W"), ("T", "W"), ("D", "W"), ("G", "W"), ("P", "Y"), ("B", "Y"), ("K", "Y"),
    ("F", "Y"), ("M", "Y"), ("HH", "Y"), ("V", "Y"),
    ("S", "P", "R"), ("S", "T", "R"), ("S", "K", "R"), ("S", "P", "L"), ("S", "K", "W"),
}


def arpabet_to_ipa(phones):
    """Chuyển một cách phát âm ARPAbet (CMU) sang IPA, có dấu nhấn chính ˈ."""
    syllable_count = sum(1 for p in phones if p[-1].isdigit())
    out = []  # danh sách (ký hiệu IPA, là_nguyên_âm, ARPAbet gốc)
    for p in phones:
        if p[-1].isdigit():
            base, stress = p[:-1], p[-1]
            if base == "AH":
                sym = "ʌ" if stress in "12" else "ə"
            elif base == "ER":
                sym = "ɜːr" if stress in "12" else "ər"
            elif base == "IY" and stress == "0":
                sym = "i"
            else:
                sym = VOWELS[base]
            out.append([sym, True, stress])
        else:
            out.append([CONS[p], False, p])

    if syllable_count > 1:
        for i, (sym, is_vowel, stress) in enumerate(out):
            if not (is_vowel and stress == "1"):
                continue
            # Lấy các phụ âm ngay trước nguyên âm nhấn, giữ cụm đầu hợp lệ dài nhất.
            j = i
            while j > 0 and not out[j - 1][1]:
                j -= 1
            cluster = [c[2] for c in out[j:i]]
            start = i
            for k in range(len(cluster), 0, -1):
                tail = tuple(cluster[-k:])
                if k == 1 or tail in ONSETS:
                    start = i - k
                    break
            out[start][0] = "ˈ" + out[start][0]
            break
    return "".join(s for s, _, _ in out)


def load_cmudict(path):
    pron = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if not line:
            continue
        word, *phones = line.split()
        if "(" in word:  # chỉ lấy cách đọc đầu tiên
            continue
        pron[word.lower()] = phones
    return pron


def word_ipa(text, cmu):
    parts = []
    for w in re.findall(r"[a-zA-Z']+", text.lower()):
        if w not in cmu:
            # Thử cách viết kiểu Mỹ của từ viết kiểu Anh (organise → organize, colour → color)
            for a, b in (("ise", "ize"), ("yse", "yze"), ("isation", "ization"), ("our", "or"), ("tre", "ter"), ("ogue", "og"), ("lled", "led"), ("lling", "ling")):
                if a in w and w.replace(a, b) in cmu:
                    w = w.replace(a, b)
                    break
            else:
                return None
        parts.append(arpabet_to_ipa(cmu[w]))
    return "/" + " ".join(parts) + "/" if parts else None


# Sửa phiên âm cho các từ đồng tự (cách đọc phụ thuộc loại từ) mà từ điển CMU lấy sai cách đọc.
IPA_FIX = {
    ("excuse", "v"): "/ɪkˈskjuːz/", ("live", "v"): "/lɪv/", ("close", "v"): "/kloʊz/",
    ("subject", "n"): "/ˈsʌbdʒɪkt/", ("read", "v"): "/riːd/", ("address", "n"): "/əˈdres/",
    ("address", "v"): "/əˈdres/", ("use", "v"): "/juːz/", ("wind", "n"): "/wɪnd/",
    ("graduate", "v"): "/ˈɡrædʒueɪt/", ("record", "v"): "/rɪˈkɔːrd/", ("suspect", "n"): "/ˈsʌspekt/",
    ("export", "v"): "/ɪkˈspɔːrt/", ("refuse", "v"): "/rɪˈfjuːz/", ("estimate", "v"): "/ˈestɪmeɪt/",
    ("wound", "n"): "/wuːnd/", ("upgrade", "v"): "/ˌʌpˈɡreɪd/", ("convict", "v"): "/kənˈvɪkt/",
    ("elaborate", "v"): "/ɪˈlæbəreɪt/", ("articulate", "adj"): "/ɑːrˈtɪkjələt/",
    ("subordinate", "n"): "/səˈbɔːrdɪnət/", ("coordinate", "v"): "/koʊˈɔːrdɪneɪt/",
    ("advocate", "v"): "/ˈædvəkeɪt/", ("tears", "n"): "/tɪrz/", ("present", "n"): "/ˈprezənt/",
    ("lead", "v"): "/liːd/", ("row", "n"): "/roʊ/", ("bow", "v"): "/baʊ/", ("minute", "n"): "/ˈmɪnɪt/",
}

IRREGULAR = {
    "be": ["am", "is", "are", "was", "were", "been"], "lose": ["lost"], "break": ["broke", "broken"],
    "shake": ["shook"], "grow": ["grew", "grown"], "steal": ["stole", "stolen"], "bring": ["brought"],
    "fall": ["fell", "fallen"], "withdraw": ["withdrew"], "overcome": ["overcame"], "undergo": ["underwent"],
    "come": ["came"], "take": ["took", "taken"], "get": ["got"], "go": ["went", "gone"], "stand": ["stood"],
    "acquit": ["acquitted"], "buy": ["bought"], "think": ["thought"], "teach": ["taught"], "catch": ["caught"],
    "make": ["made"], "give": ["gave", "given"], "see": ["saw", "seen"], "say": ["said"], "tell": ["told"],
    "find": ["found"], "leave": ["left"], "feel": ["felt"], "keep": ["kept"], "sleep": ["slept"],
    "meet": ["met"], "pay": ["paid"], "send": ["sent"], "spend": ["spent"], "lend": ["lent"],
    "build": ["built"], "write": ["wrote", "written"], "eat": ["ate", "eaten"], "drink": ["drank"],
    "run": ["ran"], "swim": ["swam"], "sing": ["sang"], "win": ["won"], "begin": ["began"],
    "forget": ["forgot", "forgotten"], "hide": ["hid", "hidden"], "ride": ["rode"], "drive": ["drove", "driven"],
    "fly": ["flew", "flown"], "throw": ["threw", "thrown"], "draw": ["drew"], "wear": ["wore"],
    "choose": ["chose", "chosen"], "speak": ["spoke", "spoken"], "understand": ["understood"],
    "hold": ["held"], "hurt": ["hurt"], "cut": ["cut"], "put": ["put"], "hit": ["hit"], "know": ["knew", "known"],
    "lie": ["lay", "lied"], "light": ["lit"], "mean": ["meant"], "read": ["read"], "sell": ["sold"],
    "sit": ["sat"], "wake": ["woke"], "bear": ["bore"], "bleed": ["bled"], "feed": ["fed"], "fight": ["fought"],
    "forgive": ["forgave"], "hear": ["heard"], "seek": ["sought"], "shut": ["shut"], "withstand": ["withstood"],
    "become": ["became"], "rise": ["rose", "risen"], "do": ["did", "does", "done"], "have": ["has", "had"],
}


def word_forms(word):
    """Các dạng biến đổi thường gặp của một từ/cụm từ (để tìm nó trong câu ví dụ)."""
    parts = word.lower().split()
    out = {" ".join(parts)}
    for idx in {0, len(parts) - 1}:
        base = parts[idx]
        variants = {base + s for s in ("s", "es", "ed", "d", "ing", "er", "est", "ly", "'s")}
        if base.endswith("y"):
            variants |= {base[:-1] + s for s in ("ies", "ied", "ier", "iest", "ily")}
        if base.endswith("e"):
            variants |= {base[:-1] + s for s in ("ing", "ed", "er", "est")}
        if re.search(r"[^aeiou][aeiou][bdgklmnprt]$", base):
            variants |= {base + base[-1] + s for s in ("ed", "ing", "er", "est")}
        variants |= set(IRREGULAR.get(base, []))
        for v in variants:
            out.add(" ".join(parts[:idx] + [v] + parts[idx + 1:]))
    return out


def find_in_example(word, example):
    """Trả về đúng đoạn chữ trong câu ví dụ ứng với từ cần học, hoặc None."""
    for f in sorted(word_forms(word), key=len, reverse=True):
        m = re.search(r"(?<![A-Za-z'])" + re.escape(f) + r"(?![A-Za-z])", example, re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def parse_sources():
    words, topics, errors = [], [], []
    for path in sorted(SRC.glob("*.txt")):
        level, topic = None, None
        for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("//"):
                continue
            where = f"{path.name}:{n}"
            if line.startswith("# "):
                level = line[2:].strip()
                if level not in LEVELS:
                    errors.append(f"{where}: cấp độ lạ {level}")
                continue
            if line.startswith("@"):
                tid, name, icon = [x.strip() for x in line[1:].split("|")]
                topic = {"id": f"{level.lower()}-{tid}", "level": level, "name": name, "icon": icon}
                topics.append(topic)
                continue
            cols = [c.strip() for c in line.split("|")]
            if len(cols) not in (6, 7):
                errors.append(f"{where}: cần 6 hoặc 7 cột, có {len(cols)}: {line}")
                continue
            if topic is None:
                errors.append(f"{where}: từ nằm ngoài chủ đề")
                continue
            w, pos, vi, emoji, ex, ex_vi = cols[:6]
            if pos not in POS:
                errors.append(f"{where}: loại từ lạ '{pos}'")
            entry = {"w": w, "pos": pos, "vi": vi, "ex": ex, "exVi": ex_vi,
                     "lv": level, "t": topic["id"]}
            if emoji:
                entry["img"] = emoji
            if len(cols) == 7 and cols[6]:
                entry["ipa"] = cols[6]
            key = find_in_example(w, ex)
            if key:
                entry["k"] = key  # dạng từ xuất hiện trong câu ví dụ, dùng cho bài điền từ
            words.append(entry)
    return words, topics, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cmudict", help="đường dẫn tới cmudict.dict")
    args = ap.parse_args()

    words, topics, errors = parse_sources()

    seen = {}
    for e in words:
        # Cho phép cùng một từ xuất hiện với loại từ khác (book n. / book v.)
        key = (e["w"].lower(), e["pos"])
        if key in seen:
            errors.append(f"Từ trùng: '{e['w']}' ({seen[key]} và {e['t']})")
        seen[key] = e["t"]

    old_ipa = {}
    if OUT.exists():
        for e in json.loads(OUT.read_text(encoding="utf-8"))["words"]:
            if e.get("ipa"):
                old_ipa[e["w"].lower()] = e["ipa"]
    cmu = load_cmudict(args.cmudict) if args.cmudict else {}

    missing = []
    for i, e in enumerate(words):
        e["id"] = i + 1
        fix = IPA_FIX.get((e["w"].lower(), e["pos"]))
        if fix and "ipa" not in e:
            e["ipa"] = fix
        if "ipa" not in e:
            ipa = word_ipa(e["w"], cmu) if cmu else None
            ipa = ipa or old_ipa.get(e["w"].lower())
            if ipa:
                e["ipa"] = ipa
            else:
                missing.append(e["w"])

    # Đặt id lên đầu cho dễ đọc
    words = [{"id": e.pop("id"), **e} for e in words]
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "topics": topics, "words": words},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    per_level = {lv: sum(1 for e in words if e["lv"] == lv) for lv in LEVELS}
    print(f"Đã ghi {len(words)} từ, {len(topics)} chủ đề → {OUT.relative_to(ROOT)}")
    print("Theo cấp độ:", per_level)
    no_key = [e["w"] for e in words if "k" not in e]
    if no_key:
        print(f"Câu ví dụ không chứa nguyên dạng từ ({len(no_key)}, sẽ bỏ qua ở bài điền từ):", ", ".join(no_key))
    if missing:
        print(f"Thiếu phiên âm ({len(missing)}):", ", ".join(missing))
    if errors:
        print("LỖI:", *errors, sep="\n  ")
        sys.exit(1)


if __name__ == "__main__":
    main()
