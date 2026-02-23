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

# --- Monkey-patches ---

# 1. 組み込みメソッドの挙動を直接書き換える (RBSより強力)
module TypeProf::Core
  class Builtin
    alias_method :orig_deploy, :deploy
    def deploy
      orig_deploy
      # gets が常に String を返すように強制
      [[:Object], [:Kernel]].each do |cpath|
        begin
          me = @genv.resolve_method(cpath, false, :gets)
          me.builtin = method(:kernel_gets) if me
        rescue
        end
      end
    end

    def kernel_gets(changes, node, ty, a_args, ret)
      vtx = Source.new(@genv.str_type)
      changes.add_edge(@genv, vtx, ret)
      true
    end
  end

  # 2. 多重代入の型推論バグの修正
  class MAsgnBox
    def run0(genv, changes)
      edges = []
      @value.each_type do |ty|
        case ty
        when Type::Array
          edges.concat(ty.splat_assign(genv, @lefts, @rest_elem, @rights))
        when Type::Instance
          if ty.mod == genv.mod_ary
            elem_vtx = ty.args[0]
            if elem_vtx
              @lefts.each {|lhs| edges << [elem_vtx, lhs] }
              edges << [Source.new(genv.gen_ary_type(elem_vtx)), @rest_elem] if @rest_elem
              @rights&.each {|rhs| edges << [elem_vtx, rhs] }
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

  # 3. update_rbs_file の安全性向上 (後から適用)
  class << core
    def update_rbs_file(path, code)
      prev_decls = @rbs_text_nodes[path]
      begin
        decls = TypeProf::Core::AST.parse_rbs(path, code || File.read(path))
      rescue
        return false
      end
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

  # インデックス構築
  core.update_file("/workspace/main.rb", "")
  
  JS.global.call(:updateProgress, 90, "LSP サーバーを起動中...")
  $server = Server.new(core)
  $server.start
rescue => e
  puts "TypeProf Startup Error: #{e.class}: #{e.message}"
  puts e.backtrace
end
