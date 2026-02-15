#!/bin/bash

# プロジェクトのルートディレクトリを取得（スクリプトのある場所の親）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET="$PROJECT_ROOT/public/rbs/ruby-stdlib.rbs"

# RBS gem のパスを動的に取得
RBS_PATH=$(ruby -e 'spec = Gem::Specification.find_by_name("rbs"); puts spec.gem_dir' 2>/dev/null)

if [ -z "$RBS_PATH" ]; then
    echo "Error: rbs gem not found. Please install it with 'bundle install' or 'gem install rbs'."
    exit 1
fi

rm -f "$TARGET"
mkdir -p "$(dirname "$PROJECT_ROOT/public/rbs/")"

cd "$RBS_PATH" || exit 1

# core のみの RBS ファイルをマージ（調査用）
find core -name '*.rbs' | while read -r f; do
    grep -v '^ *prepend ' "$f" >> "$TARGET"
    echo "" >> "$TARGET"
done

echo "Merged RBS to $TARGET, size: $(du -sh "$TARGET" | cut -f1)"
