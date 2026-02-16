#!/bin/bash
set -e

# RBS gem のディレクトリを取得
RBS_DIR=$(ls -d wasm-build/vendor/bundle/ruby/*/gems/rbs-* | head -n 1)
OUTPUT="public/rbs/ruby-stdlib.rbs"
TEMP_OUTPUT="public/rbs/ruby-stdlib.tmp.rbs"

mkdir -p public/rbs

echo "Bundling RBS (Core + Stdlib)..."
echo "Using RBS from: $RBS_DIR"

# 1. Clear output
true > $TEMP_OUTPUT

# 2. Core definitions (Built-in classes like Object, Kernel, Array, etc.)
echo "Adding RBS core definitions..."
find "$RBS_DIR/core" -name "*.rbs" -exec cat {} + >> $TEMP_OUTPUT

# 3. Comprehensive Stdlib definitions
STDLIB_LIST="base64 benchmark bigdecimal cgi coverage csv date delegate \
             did_you_mean digest erb etc fileutils find forwardable \
             io-console ipaddr json kconv logger monitor mutex_m \
             net-http net-protocol net-smtp nkf objspace observable \
             open-uri open3 openssl optparse pathname pp prettyprint \
             pstore psych pty rdoc resolv ripper securerandom \
             shellwords singleton socket stringio strscan tempfile \
             time timeout tmpdir tsort uri yaml zlib"

for lib in $STDLIB_LIST; do
  LIB_PATH="$RBS_DIR/stdlib/$lib"
  if [ -d "$LIB_PATH" ]; then
    echo "Adding stdlib: $lib"
    find "$LIB_PATH" -name "*.rbs" -exec cat {} + >> $TEMP_OUTPUT
  fi
done

# 4. Add RBS from other gems that bundle their own sigs (like 'prime')
# These are found in wasm-build/vendor/bundle/ruby/*/gems/<gem_name>-<version>/sig
# or in the build artifacts (for default gems).
GEM_DIR=$(dirname "$RBS_DIR")
OTHER_GEMS="prime"
for gem_name in $OTHER_GEMS; do
  # First, check vendor/bundle
  GEM_PATH=$(ls -d "$GEM_DIR/$gem_name-"* 2>/dev/null | head -n 1)
  
  if [ ! -d "$GEM_PATH/sig" ]; then
    # Fallback: search in the whole wasm-build directory (e.g. build artifacts)
    echo "Gem sigs not found in vendor/bundle for $gem_name. Searching fallbacks..."
    SIG_FILE=$(find wasm-build -name "$gem_name.rbs" -path "*/sig/*" 2>/dev/null | head -n 1)
    if [ -n "$SIG_FILE" ]; then
      GEM_PATH=$(dirname $(dirname "$SIG_FILE"))
    fi
  fi

  if [ -d "$GEM_PATH/sig" ]; then
    echo "Adding gem sigs: $gem_name from $GEM_PATH"
    find "$GEM_PATH/sig" -name "*.rbs" -exec cat {} + >> $TEMP_OUTPUT
  else
    echo "Warning: RBS for gem '$gem_name' NOT found."
  fi
done

# 5. Filter unsupported members (prepend)
# TypeProf 0.30.1 does not support RBS 'prepend' member.
echo "Filtering unsupported RBS members (prepend)..."
sed -e 's/^[[:space:]]*prepend[[:space:]]\+/# prepend /g' $TEMP_OUTPUT > $OUTPUT
rm $TEMP_OUTPUT

echo "RBS bundling complete: $OUTPUT ($(du -h $OUTPUT | cut -f1))"
