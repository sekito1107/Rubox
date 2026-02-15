# ワークスペースのセットアップ
# TypeProfは /workspace などのディレクトリ構造を期待している可能性があるため
if !Dir.exist?("/workspace")
  Dir.mkdir("/workspace")
end

# CRITICAL: TypeProfがカレントディレクトリの設定ファイルを探すため
# 設定ファイルのある /workspace に移動する
Dir.chdir("/workspace")

File.write("/workspace/typeprof.conf.json", <<JSON)
{
  "typeprof_version": "experimental",
  "rbs_dir": ".",
  "analysis_unit_dirs": ["."]
}
JSON

File.write("/workspace/test.rb", "")
File.write("/workspace/main.rb", "") # TypeProfの初期スキャンで検出させるために作成

# stdlib.rbs がなければ空ファイルでフォールバック
File.write("/workspace/stdlib.rbs", "") unless File.exist?("/workspace/stdlib.rbs")
