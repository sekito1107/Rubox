require "js"
require "rubygems"

# 自前ファイルを相対パスで読み込む（環境パッチを最優先）
require_relative "env"

# 外部ライブラリ
require "typeprof"
require "typeprof/lsp"

# 自前ファイル
require_relative "workspace"
require_relative "measure_value"
require_relative "server"

# TypeProf 0.30.1 の初期化バグ（@rbs_env が nil になる）を修正するパッチ
module TypeProf::Core
  class Service
    alias_method :_orig_update_rbs_file, :update_rbs_file
    def update_rbs_file(path, content)
      @rbs_env ||= RBS::Environment.new
      _orig_update_rbs_file(path, content)
    end
  end
end

# パッチ適用後に初期化
rbs_path = "/rbs/ruby-stdlib.rbs"
core = TypeProf::Core::Service.new(rbs_files: [rbs_path])

# ウォームアップ
begin
  iseq_klass = defined?(TypeProf::Core::ISeq) ? TypeProf::Core::ISeq : (defined?(TypeProf::ISeq) ? TypeProf::ISeq : nil)
  if iseq_klass
    iseq_klass.compile("Array.new; 'str'.upcase; {a: 1}.keys").each { |iseq| core.add_iseq(iseq) }
  end
rescue
end

$server = Server.new(core)
$server.start
