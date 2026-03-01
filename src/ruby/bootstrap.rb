require "js"
JS.global.call(:updateProgress, 82, "RubyGems をロード中...")
require "rubygems"
require "pathname"

# WASM環境用のモック設定
require_relative "env"

# 外部ライブラリ
JS.global.call(:updateProgress, 84, "TypeProf をロード中...")
require "typeprof"
require "typeprof/lsp"

# 自前ファイル
require_relative "workspace"
require_relative "measure_value"
require_relative "server"
require_relative "typeprof_patches"

# --- Monkey-patches ---
TypeProfPatches.apply!

# RBSとTypeProfコアの初期化
begin
  JS.global.call(:updateProgress, 85, "RBS 環境を初期化中...")
  
  rbs_path = "/workspace/rbs/ruby-stdlib.rbs"
  rbs_path = "/workspace/stdlib.rbs" unless File.exist?(rbs_path)
  
  if File.exist?(rbs_path)
    loader = RBS::EnvironmentLoader.new(core_root: nil)
    loader.add(path: Pathname.new(rbs_path))
    $raw_rbs_env = RBS::Environment.from_loader(loader)
  else
    $raw_rbs_env = RBS::Environment.new
  end

  JS.global.call(:updateProgress, 87, "TypeProf サービスを初期化中...")
  core = TypeProf::Core::Service.new(rbs_env: $raw_rbs_env, rbs_collection: nil)

  # update_rbs_file の安全性を向上
  TypeProfPatches.patch_service(core)

  # インデックス構築
  core.update_file("/workspace/main.rb", "")
  
  JS.global.call(:updateProgress, 90, "LSP サーバーを起動中...")
  $server = Server.new(core)
  $server.start
rescue => e
  puts "TypeProf Startup Error: #{e.class}: #{e.message}"
  puts e.backtrace
end
