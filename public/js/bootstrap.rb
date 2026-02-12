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
      captured_val = nil
      found = false
      
      begin
        # Measure Value 用に独立したBindingを作成
        measure_binding = TOPLEVEL_BINDING.eval("binding")
        
        # 最新のコードを読み込む
        if File.exist?("/workspace/main.rb")
          code_str = File.read("/workspace/main.rb")
          
          tp = TracePoint.new(:line) do |tp|
            if tp.lineno == target_line && tp.path == "(eval)"
              begin
                CapturedValue.set(tp.binding.eval(expression))
                CapturedValue.found = true
                raise "RubPad::StopExecution"
              rescue => e
                if e.message == "RubPad::StopExecution"
                  raise e
                end
              end
            end
          end

          # 標準出力を抑制しつつ実行
          measure_binding.eval("require 'stringio'; $stdout = StringIO.new")
          
          begin
            tp.enable
            measure_binding.eval(code_str, "(eval)")
          rescue => e
            # 想定通りの停止であれば無視
            raise e if e.message != "RubPad::StopExecution"
          ensure
            tp.disable
          end
        end

        if CapturedValue.found
          result_str = CapturedValue.get.inspect
        else
          # 行に到達しなかった場合(条件分岐等)、全体実行後の状態で評価を試みる
          begin
             val = measure_binding.eval(expression)
             result_str = val.inspect
          rescue
             result_str = "" 
          end
        end
      rescue => e
        if CapturedValue.found
           result_str = CapturedValue.get.inspect
        else
           # StopExecutionの場合はここには来ないはずだが念のため
           if e.message == "RubPad::StopExecution"
             result_str = CapturedValue.get.inspect
           else
             result_str = "(Error: " + e.message + ")"
           end
        end
      end
      
      # クリーンアップ
      CapturedValue.reset

      write(id: json[:id], result: result_str)
    else
      write(id: json[:id], error: { code: -32601, message: "Method not found" })
    end
  end

  # 値の受け渡し用クラス
  class CapturedValue
    @val = nil
    @found = false
    class << self
      attr_accessor :found
      def set(v)
        @val = v
      end
      def get
        @val
      end
      def reset
        @val = nil
        @found = false
      end
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

