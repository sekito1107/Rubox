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
class RubbitStopExecution < StandardError; end

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
    if (json[:method] == "textDocument/didChange")
      changes = json[:params][:contentChanges]
      if changes
        current_text = File.read("/workspace/main.rb") rescue ""
        lines = current_text.split("\n", -1)

        changes.each do |change|
          if change[:range]
            start_pos = change[:range][:start]
            end_pos = change[:range][:end]
            new_text_lines = (change[:text] || "").split("\n", -1)

            start_line = lines[start_pos[:line]] || ""
            end_line = lines[end_pos[:line]] || ""

            prefix = start_line[0...start_pos[:character]] || ""
            suffix = end_line[end_pos[:character]...] || ""
            
            if new_text_lines.size == 1
              new_text_lines[0] = prefix + (new_text_lines[0] || "") + suffix
            else
              new_text_lines[0] = prefix + (new_text_lines[0] || "")
              new_text_lines[-1] = (new_text_lines[-1] || "") + suffix
            end
            
            lines[start_pos[:line]..end_pos[:line]] = new_text_lines
          else
            lines = (change[:text] || "").split("\n", -1)
          end
        end
        File.write("/workspace/main.rb", lines.join("\n"))
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
      write(method: "rubbit/syntaxCheck", params: { valid: true })
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
      write(method: "rubbit/syntaxCheck", params: { valid: false, diagnostics: [diag] })
    rescue => e
      # その他のエラーは無視
    end
  end

  def handle_execute_command(json)
    params = json[:params]
    case params[:command]
    when "typeprof.measureValue"
      expression = json[:params][:arguments][0][:expression]
      target_line = json[:params][:arguments][0][:line] + 1
      
      CapturedValue.reset
      max_captures = 10 # 最大キャプチャ数
      
      # 実行中のバインディング
      begin
        # Measure Value 用に独立したBindingを作成
        measure_binding = TOPLEVEL_BINDING.eval("binding")
        
        # 最新のコードを読み込む
        if File.exist?("/workspace/main.rb")
          code_str = File.read("/workspace/main.rb") + "\nnil"

          tp = TracePoint.new(:line, :call, :return, :class, :end, :b_call, :b_return) do |tp|
            next unless tp.path == "(eval)"

            if tp.lineno == target_line && !CapturedValue.target_triggered
              # ターゲット行に到達した際、まだ実行が終わっていないためフラグを立ててスキップし、
              # 次のイベント（行内の実行完了後など）で値をキャプチャする。
              CapturedValue.target_triggered = true
              next
            end

            if CapturedValue.target_triggered && tp.lineno != target_line
               # ターゲット行から抜けたタイミング（次の行へ移動、あるいはメソッドから戻る時など）
               # ただし、ループ内だと同じ行に戻ってくることもあるので注意が必要。
               # ここでは「ターゲット行でトリガーされた後、何らかの次のステップに進んだ」時点で評価を試みる。
               
               # 単純化: ターゲット行を実行し終えた直後（次の行へ移るか、ブロック終了など）
               # しかし、同一行で複数回呼ばれるケース（ループ）では、
               # tp.lineno が target_line に戻ってくることもある。
            end

            if CapturedValue.target_triggered
              begin
                val = tp.binding.eval(expression)
                CapturedValue.add(val)
                
                # キャプチャしたらトリガーをリセットして次のループに備える
                CapturedValue.target_triggered = false
                
                if CapturedValue.count >= max_captures
                  raise RubbitStopExecution
                end
              rescue RubbitStopExecution
                raise
              rescue => e
                # まだ評価できない場合(NameError等)かつターゲット行内の場合は続行。
                # 物理行を超えていたら（ターゲット行をスキップした場合など）諦めて記録。
                if tp.lineno > target_line
                  CapturedValue.add(e)
                  CapturedValue.target_triggered = false
                end
              end
            end
          end

          # 標準出力を抑制しつつ実行
          measure_binding.eval("require 'stringio'; $stdout = StringIO.new")
          
          begin
            tp.enable do
              measure_binding.eval(code_str, "(eval)")
            end
          rescue RubbitStopExecution
            # 正常停止（制限に達したなど）
          rescue => e
            # 実行時エラーがあればそれも記録
            CapturedValue.add(e) unless CapturedValue.found?
          end
        end

        if CapturedValue.found?
          results = CapturedValue.get_all.map do |val|
            if val.is_a?(Exception)
              "(#{val.class}: #{val.message})"
            else
              # 評価結果の inspect 文字列を取得
              result_str = val.inspect.to_s
              limit = 200
              if result_str.length > limit
                result_str = result_str[0...limit] + "..."
              end
              result_str
            end
          end
          # 結果を連結して返す
          result_str = results.join(", ")
        else
          # 行に到達しなかった場合
          result_str = ""
        end
      rescue => e
        if CapturedValue.found?
           # 部分的に取得できた場合
           results = CapturedValue.get_all.map { |v| v.inspect }
           result_str = results.join(", ")
        else
           if e.message == "Rubbit::StopExecution"
             results = CapturedValue.get_all.map { |v| v.inspect }
             result_str = results.join(", ")
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
    @vals = []
    @target_triggered = false
    class << self
      attr_accessor :target_triggered
      
      def add(v)
        @vals << v
      end
      
      def get_all
        @vals
      end
      
      def found?
        !@vals.empty?
      end
      
      def count
        @vals.size
      end

      def reset
        @vals = []
        @target_triggered = false
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

