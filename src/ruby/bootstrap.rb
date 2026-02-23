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

# RBSとTypeProfコアの初期化
begin
  JS.global.call(:updateProgress, 85, "RBS 環境を初期化中...")
  
  # bundle_rbs.sh が生成する場所
  rbs_path = "/workspace/rbs/ruby-stdlib.rbs"
  rbs_path = "/workspace/stdlib.rbs" unless File.exist?(rbs_path)
  
  JS.global.call(:updateProgress, 86, "RBS 環境を構築中...")
  if File.exist?(rbs_path)
    loader = RBS::EnvironmentLoader.new(core_root: nil)
    loader.add(path: Pathname.new(rbs_path))
    $raw_rbs_env = RBS::Environment.from_loader(loader)
  else
    $raw_rbs_env = RBS::Environment.new
  end
  
  JS.global.call(:updateProgress, 87, "TypeProf サービスを初期化中...")
  
  # TypeProf Service の作成 (RBS環境を明示的に渡す)
  # rbs_collection: nil を渡すことで自動ロードを抑制
  core = TypeProf::Core::Service.new(rbs_env: $raw_rbs_env, rbs_collection: nil)
  
  # インデックス構築の強制（LSP開始前に同期的に完了させる）
  code = ""
  JS.global.call(:updateProgress, 89, "インデックスを事前ロード中...")
  core.update_file("/workspace/main.rb", code)
  
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

  # 多重代入の型推論バグの修正 (TypeProf 0.31.x 向け)
  # 右辺が Type::Array (Tuple) ではなく、Type::Instance の Array (動的配列) である場合に
  # 要素の型を正しく変数へ分配するようにする
  module TypeProf::Core
    class MAsgnBox
      def run0(genv, changes)
        edges = []
        @value.each_type do |ty|
          case ty
          when Type::Array
            edges.concat(ty.splat_assign(genv, @lefts, @rest_elem, @rights))
          when Type::Instance
            # 動的な Array 型の場合、その全要素型を各左辺変数へ分配する
            if ty.mod == genv.mod_ary
              elem_vtx = ty.args[0]
              if elem_vtx
                @lefts.each {|lhs| edges << [elem_vtx, lhs] }
                edges << [Source.new(genv.gen_ary_type(elem_vtx)), @rest_elem] if @rest_elem
                @rights&.each {|rhs| edges << [elem_vtx, rhs] }
              end
            else
              # Array 以外の場合のフォールバック
              if @lefts.size >= 1
                edges << [Source.new(ty), @lefts[0]]
              elsif @rights && @rights.size >= 1
                edges << [Source.new(ty), @rights[0]]
              else
                edges << [Source.new(ty), @rest_elem]
              end
            end
          else
            if @lefts.size >= 1
              edges << [Source.new(ty), @lefts[0]]
            elsif @rights && @rights.size >= 1
              edges << [Source.new(ty), @rights[0]]
            else
              edges << [Source.new(ty), @rest_elem]
            end
          end
        end
        edges.each {|src, dst| changes.add_edge(genv, src, dst) }
      end
    end
  end

  # gets が nil を返す可能性があることによる警告を抑制するための RBS 注入
  # (競プロ等のユースケースでは入力があることが前提のため、String を返すものとして扱う)
  $raw_rbs_env << TypeProf::Core::AST.parse_rbs("rubox-shim.rbs", <<~RBS).first
    class Object
      def gets: (?String | Integer sep, ?Integer limit) -> String
             | (Integer limit) -> String
    end
  RBS

  # TypeProf Service の初期化（同期モード）
  JS.global.call(:updateProgress, 90, "LSP サーバーを起動中...")
  $server = Server.new(core)
  $server.start
rescue => e
  puts "TypeProf Startup Error: #{e.class}: #{e.message}"
  puts e.backtrace
end
