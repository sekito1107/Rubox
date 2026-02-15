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

# DEBUG: RBS解析の進捗をログ出力するためのモンキーパッチ
module RBS
  class Parser
    alias_method :original_parse_signature, :parse_signature
    def parse_signature(source, **)
      if source =~ /^\s*(class|module)\s+([A-Z][a-zA-Z0-9_:]*)/
        puts "DEBUG: [RBS] Parsing #{$1} #{$2}"
      end
      original_parse_signature(source, **)
    end
  end
end

# TypeProfコアの初期化
rbs_path = "/workspace/stdlib.rbs"
rbs_list = File.exist?(rbs_path) ? [rbs_path] : []
core = TypeProf::Core::Service.new(rbs_files: rbs_list)

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
