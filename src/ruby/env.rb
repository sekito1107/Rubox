# エンコーディングを UTF-8 に固定
Encoding.default_external = "UTF-8"
Encoding.default_internal = "UTF-8"

# "io/console" と "socket" の読み込みをスキップする
# (これらは ruby.wasm 上の TypeProf では使用されないため)
$LOADED_FEATURES << "io/console.so" << "socket.so" << "io/console" << "socket" << "io/console.rb" << "socket.rb"

# File.readable? は bjorn3/browser_wasi_shim では動作しないため代用
def File.readable?(...) = File.file?(...)

class RubbitStopExecution < StandardError; end
