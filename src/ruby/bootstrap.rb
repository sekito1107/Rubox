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

# TypeProfコアの初期化
rbs_path = "/rbs/ruby-stdlib.rbs"
rbs_list = File.exist?(rbs_path) ? [rbs_path] : []

begin
  core = TypeProf::Core::Service.new(rbs_files: rbs_list)
rescue
  core = TypeProf::Core::Service.new(rbs_files: []) # Fallback
end

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
