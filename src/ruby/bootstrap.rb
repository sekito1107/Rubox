require "js"
require "rubygems"
require "pathname"

# WASM環境用のモック設定 (env.rb はユーザーの .so 形式を維持)
require_relative "env"

# TypeProf 0.3x は io/console と socket を要求するため、bootstrap.rb 指定で一時的に回避
# (env.rb の実績ある設定を尊重しつつ、ここでは TypeProf が起動できる状態にする)
$LOADED_FEATURES << "io/console" << "socket" << "io/console.rb" << "socket.rb"

# 外部ライブラリ
require "typeprof"
require "typeprof/lsp"

# 自前ファイル
require_relative "workspace"
require_relative "measure_value"
require_relative "server"

# RBSとTypeProfコアの初期化
begin
  # bundle_rbs.sh が生成する場所
  rbs_path = "/workspace/rbs/ruby-stdlib.rbs"
  rbs_path = "/workspace/stdlib.rbs" unless File.exist?(rbs_path)
  
  if File.exist?(rbs_path)
    puts "Loading bundled RBS from #{rbs_path}..."
    loader = RBS::EnvironmentLoader.new(core_root: nil)
    loader.add(path: Pathname.new(rbs_path))
    $raw_rbs_env = RBS::Environment.from_loader(loader)
    puts "RBS Environment created. Decls: #{$raw_rbs_env.declarations.size}"
  else
    puts "Warning: RBS NOT found at #{rbs_path}. Analysis will be limited."
    $raw_rbs_env = RBS::Environment.new
  end
  
  # TypeProf Service の作成 (RBS環境を明示的に渡す)
  # rbs_collection: nil を渡すことで自動ロードを抑制
  core = TypeProf::Core::Service.new(rbs_env: $raw_rbs_env, rbs_collection: nil)
  
  # インデックス構築の強制（LSP開始前に同期的に完了させる）
  core.update_file("/workspace/main.rb", "")
  
  # LSP Error: undefined method 'define' for nil を防ぐためのモンキーパッチ
  # AST.parse_rbs が nil を返す場合に備えて compact を挟む
  class << core
    alias_method :orig_update_rbs_file, :update_rbs_file
    def update_rbs_file(path, code)
      prev_decls = @rbs_text_nodes[path]
      code = File.read(path) unless code
      begin
        decls = TypeProf::Core::AST.parse_rbs(path, code)
      rescue RBS::ParsingError
        return false
      end
      # nil を除外してクラッシュを防ぐ
      decls = decls.compact
      @rbs_text_nodes[path] = decls
      decls.each {|decl| decl.define(@genv) }
      prev_decls.each {|decl| decl.undefine(@genv) } if prev_decls
      @genv.define_all
      decls.each {|decl| decl.install(@genv) }
      prev_decls.each {|decl| decl.uninstall(@genv) } if prev_decls
      @genv.run_all
      true
    end
  end

  puts "TypeProf Service initialized (sync mode)"
  
  $server = Server.new(core)
  $server.start
rescue => e
  puts "TypeProf Startup Error: #{e.class}: #{e.message}"
  puts e.backtrace
end
