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

# TypeProfコアの初期化 (バグ回避のための手動ロード)
rbs_path = "/rbs/ruby-stdlib.rbs"
rbs_content = File.exist?(rbs_path) ? File.read(rbs_path) : nil

# 1. まず空で初期化 (コンストラクタでの nil ガードを確実に通す)
core = TypeProf::Core::Service.new(rbs_files: [])

# 2. 初期化完了後 (instanceができた後) にロードする
if rbs_content
  core.update_rbs_file(rbs_path, rbs_content)
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
