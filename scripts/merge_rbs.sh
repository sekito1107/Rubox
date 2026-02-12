#!/bin/bash
TARGET="/home/bonnmasa/app/rubbit/public/rbs/ruby-stdlib.rbs"
rm -f "$TARGET"
mkdir -p "$(dirname "$TARGET")"
cd /usr/lib/ruby/gems/3.1.0/gems/rbs-2.1.0 || exit 1
find core stdlib -name '*.rbs' | while read -r f; do
    cat "$f" >> "$TARGET"
    echo "" >> "$TARGET"
done
echo "Merged RBS to $TARGET, size: $(du -sh $TARGET)"
