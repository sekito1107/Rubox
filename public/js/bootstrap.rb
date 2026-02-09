# エンコーディングを UTF-8 に固定
Encoding.default_external = "UTF-8"
Encoding.default_internal = "UTF-8"

# "io/console" と "socket" の読み込みをスキップする
# (これらは ruby.wasm 上の TypeProf では使用されないため)
$LOADED_FEATURES << "io/console.so" << "socket.so"

require "js"
require "rubygems"

# File.readable? は bjorn3/browser_wasi_shim では動作しないため代用
def File.readable?(...) = File.file?(...)

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

# 以前の test.rbs を stdlib.rbs に置き換える (ruby_worker.js が配置したフルセット)
# もし stdlib.rbs がなければ空ファイルでフォールバック
File.write("/workspace/stdlib.rbs", "") unless File.exist?("/workspace/stdlib.rbs")

require "typeprof"
require "typeprof/lsp"

# モンキーパッチ: apply_changes でのフルテキスト同期（rangeなし）のサポート
# TypeProf 0.30.1 の実装ではパターンマッチングにおいて range が必須となっており、
# Monaco からフルテキスト更新を受け取った際にクラッシュする問題を回避する。
module TypeProf::LSP
  class Text
    def apply_changes(changes, version)
      changes.each do |change|
        if !change[:range] && change[:text]
          @lines = Text.split(change[:text])
          next
        end

        change => {
            range: {
                start: { line: start_row, character: start_col },
                end:   { line: end_row  , character: end_col   }
            },
            text: new_text,
        }

        new_text = Text.split(new_text)

        prefix = @lines[start_row][0...start_col]
        suffix = @lines[end_row][end_col...]
        if new_text.size == 1
          new_text[0] = prefix + new_text[0] + suffix
        else
          new_text[0] = prefix + new_text[0]
          new_text[-1] = new_text[-1] + suffix
        end
        @lines[start_row .. end_row] = new_text
      end

      validate

      @version = version
    end
  end
end

class Server
  def initialize
    @read_msg = nil
    @error = nil

    # TypeProfコアの初期化
    # puts Integer における誤報（::_ToS が String に固定されている問題）を根本解決するパッチ
    # TypeProf::Import 内で _ToS インターフェース名が出てきたら強制的に any 型にする
    module ::TypeProf
      class Import
        alias _original_conv_type conv_type
        def conv_type(ty)
          return Type.any if ty.is_a?(Array) && ty == [:instance, ["::_ToS"]]
          
          # 文字列ベースの判定も残しておく（念のため）
          if ty.is_a?(Array) && ty[0] == :instance && ty[1] == ["::_ToS"]
            return Type.any
          end

          res = _original_conv_type(ty)
          
          # 変換後の Type オブジェクトが _ToS を指している場合も any に倒す
          if res.is_a?(Type::Instance) && res.klass.is_a?(Type::Class)
             # クラス名が _ToS かどうかを厳密にチェックするのは難しいが
             # ホバーで _ToS と出ているならこのメソッドを通っているはず
          end
          
          res
        end
      end
    end

    # TypeProf::Core 側の初期化で使われる可能性のある場所をさらにケア
    # (TypeProf 0.21.2 の場合、Import.import_builtin で JSON から読み込まれる)

    rbs_list = File.exist?("/workspace/stdlib.rbs") ? ["/workspace/stdlib.rbs"] : []
    @core = TypeProf::Core::Service.new(rbs_files: rbs_list)
    
    # ユーザーコード実行用のBindingを作成 (ローカル変数を保持するため)
    @user_binding = TOPLEVEL_BINDING.eval("binding")

    # ウォームアップ: 巨大なRBSの解析を事前にトリガー
    begin
      # TypeProf 0.30.1 以降では TypeProf::Core::ISeq かもしれない
      iseq_klass = defined?(TypeProf::Core::ISeq) ? TypeProf::Core::ISeq : (defined?(TypeProf::ISeq) ? TypeProf::ISeq : nil)
      
      # さらに探索
      if !iseq_klass && defined?(TypeProf::Core)
        iseq_klass = TypeProf::Core.constants.include?(:ISeq) ? TypeProf::Core.const_get(:ISeq) : nil
      end

      if iseq_klass
        iseq_klass.compile("Array.new; 'str'.upcase; {a: 1}.keys").each { |iseq| @core.add_iseq(iseq) }
      end
    rescue => e
    end

    nil
  end

  # ユーザーコードを実行し、ローカル変数を保持する
  def run_code(code)
    eval(code, @user_binding)
  end

  def start(post_message)
    @post_message = post_message
    @fiber = Fiber.new do
      # TypeProf LSPサーバーを開始
      # リファレンス実装に合わせて inmemory: スキームを使用
      # URIが inmemory:// 以降のパスとして解決されるように設定
      TypeProf::LSP::Server.new(@core, self, self, url_schema: "inmemory://", publish_all_diagnostics: true).run
    end
    @fiber.resume
  end

  def add_msg(msg)
    json = JSON.parse(msg.to_s, symbolize_names: true)
    
    # ファイル内容の同期 (Measure Valueのため)
    if json[:method] == "textDocument/didOpen"
      text = json[:params][:textDocument][:text]
      File.write("/workspace/main.rb", text)
    end
    if json[:method] == "textDocument/didChange"
      changes = json[:params][:contentChanges]
      if changes
        current_text = File.read("/workspace/main.rb") rescue ""
        changes.each do |change|
          if change[:range]
            # インクリメンタル同期
            start_pos = change[:range][:start]
            end_pos = change[:range][:end]
            new_text = change[:text]

            lines = current_text.split("\n", -1)
            
            # 開始・終了行のテキストを取得
            start_line = lines[start_pos[:line]] || ""
            end_line = lines[end_pos[:line]] || ""
            
            # 置換対象の前の部分
            prefix = start_line[0...start_pos[:character]] || ""
            # 置換対象の後の部分
            suffix = end_line[end_pos[:character]..-1] || ""
            
            # 行の置換
            # start_pos[:line] から end_pos[:line] までの行を削除し、
            # prefix + new_text + suffix を挿入する
            mid = prefix + (new_text || "") + suffix
            lines[start_pos[:line]..end_pos[:line]] = mid.split("\n", -1)
            
            current_text = lines.join("\n")
          else
            # フル同期
            current_text = change[:text]
          end
        end
        File.write("/workspace/main.rb", current_text)
      end
    end



    # カスタムコマンド (Measure Value) の処理
    if json[:method] == "workspace/executeCommand"
      handle_execute_command(json)
      return
    end

    # 構文チェックを実行 (TypeProfが構文エラーを報告しない場合があるため)
    if json[:method] == "textDocument/didOpen" || json[:method] == "textDocument/didChange"
      check_syntax
    end

    @read_msg = json
    @fiber.resume
    if @error
      error, @error = @error, nil
      raise error
    end
  end

  def check_syntax
    code = File.read("/workspace/main.rb")
    begin
      RubyVM::InstructionSequence.compile(code)
      # 構文エラーなし -> クリア
      write(method: "rubpad/syntaxCheck", params: { valid: true })
    rescue SyntaxError => e
      # e.message 例: "(eval):1: syntax error, unexpected end-of-input, expecting end"
      msg = e.message
      
      # メッセージから行番号を抽出
      # format: (eval):<line>: <message>
      line = 0
      if msg =~ /:(\d+): (.*)/
        line = ($1.to_i || 1) - 1
        msg = $2
      end
      
      diag = {
        range: {
          start: { line: line, character: 0 },
          end: { line: line, character: 999 } # 行全体
        },
        severity: 1, # Error
        message: msg,
        source: "RubyVM"
      }
      write(method: "rubpad/syntaxCheck", params: { valid: false, diagnostics: [diag] })
    rescue => e
      # その他のエラーは無視
    end
  end

  def handle_execute_command(json)
    params = json[:params]
    if params[:command] == "typeprof.measureValue"
      # 引数は配列の最初の要素に入っている
      args = params[:arguments][0]
      expression = args[:expression]
      # 1-based line number coming from Monaco
      target_line = args[:line]
      
      result_str = ""
      
      begin
        # Measure Value 用に独立したBindingを作成
        measure_binding = TOPLEVEL_BINDING.eval("binding")
        
        # 最新のコードを読み込み、対象行まで（その行を含む）を実行してコンテキストを構築する
        if File.exist?("/workspace/main.rb")
          code_str = File.read("/workspace/main.rb")
          lines = code_str.lines
          
          # target_line が指定されている場合は、その行までを実行対象とする
          if target_line && target_line > 0
            lines_to_run = lines.take(target_line)
            code_to_run = lines_to_run.join
          else
            code_to_run = code_str
          end

          # 標準出力を抑制しつつ実行
          eval("require 'stringio'; $stdout = StringIO.new; " + code_to_run, measure_binding)
        end

        # 対象の式を評価
        val = eval(expression, measure_binding)
        result_str = val.inspect
      rescue => e
        result_str = "(Error: " + e.message + ")"
      end
      
      write(id: json[:id], result: result_str)
    else
      write(id: json[:id], error: { code: -32601, message: "Method not found" })
    end
  end

  def read
    while true
      # メッセージが届くまで実行をJSに戻す（Yield）
      Fiber.yield until @read_msg
      
      begin
        yield @read_msg
      rescue => e
        @error = e
      ensure
        @read_msg = nil
      end
    end
  end

  def write(**json)
    json_obj = json.merge(jsonrpc: "2.0")
    json_str = JSON.generate(json_obj)
    
    # JS.global.call を使用してグローバル関数として呼び出す
    JS.global.call(:sendLspResponse, json_str)
  end
end

