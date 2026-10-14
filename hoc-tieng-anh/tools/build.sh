#!/bin/sh
# Dựng lại data/words.json. Có thể truyền đường dẫn cmudict.dict để tạo phiên âm cho từ mới.
cd "$(dirname "$0")/.." && python3 tools/build_data.py ${1:+--cmudict "$1"}
