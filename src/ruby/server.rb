require "json"

# モンキーパッチ: apply_changes でのフルテキスト同期（rangeなし）のサポート
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
  def initialize(core)
    @read_msg = nil
    @error = nil
    @core = core
    
    # ユーザーコード実行用のBindingを作成 (ローカル変数を保持するため)
    @user_binding = TOPLEVEL_BINDING.eval("binding")
  end

  def start
    @fiber = Fiber.new do
      # TypeProf LSPサーバーを開始
      TypeProf::LSP::Server.new(@core, self, self, url_schema: "inmemory://", publish_all_diagnostics: true).run
    end
    @fiber.resume
  end

  # LSPクライアントからのメッセージを受け取る
  def add_msg(msg)
    json = JSON.parse(msg.to_s, symbolize_names: true)
    
    # メッセージ種類に応じた事前処理
    case json[:method]
    when "textDocument/didOpen"
      File.write("/workspace/main.rb", json[:params][:textDocument][:text])
      check_syntax
    when "textDocument/didChange"
      apply_changes_to_file(json[:params][:contentChanges])
      check_syntax
    when "workspace/executeCommand"
      handle_execute_command(json)
      return
    end

    @read_msg = json
    begin
      @fiber.resume
    rescue => e
      write(method: "window/showMessage", params: { type: 1, message: "LSP Fatal Error: #{e.message}" })
    end

    if @error
      error, @error = @error, nil
      raise error
    end
  end

  # LSPサーバーがメッセージを読み取るためのインターフェース
  def read
    while true
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

  # LSPサーバが応答を書き込むためのインターフェース
  def write(json)
    json_obj = json.merge(jsonrpc: "2.0")
    # JS.global.call を使用してグローバル関数として呼び出す
    JS.global.call(:sendLspResponse, JSON.generate(json_obj))
  end

  # ユーザーコードを実行し、ローカル変数を保持する
  def run_code(code)
    eval(code, @user_binding)
  end

  private

  def handle_execute_command(json)
    params = json[:params]
    case params[:command]
    when "typeprof.measureValue"
      expression = params[:arguments][0][:expression]
      target_line = params[:arguments][0][:line] + 1
      result = MeasureValue.run(expression, target_line, @user_binding)
      write(id: json[:id], result: result)
    else
      write(id: json[:id], error: { code: -32601, message: "Method not found" })
    end
  end

  def check_syntax
    code = File.read("/workspace/main.rb")
    begin
      RubyVM::InstructionSequence.compile(code)
      write(method: "rubbit/syntaxCheck", params: { valid: true })
    rescue SyntaxError => e
      msg = e.message
      line = 0
      if msg =~ /:(\d+): (.*)/
        line = ($1.to_i || 1) - 1
        msg = $2
      end
      
      diag = {
        range: {
          start: { line: line, character: 0 },
          end: { line: line, character: 999 }
        },
        severity: 1,
        message: msg,
        source: "RubyVM"
      }
      write(method: "rubbit/syntaxCheck", params: { valid: false, diagnostics: [diag] })
    rescue
    end
  end

  def apply_changes_to_file(changes)
    return unless changes
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
