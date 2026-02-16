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
    when "rubbit.resolveSignature"
      class_name = params[:arguments][0]
      method_name = params[:arguments][1]
      result = resolve_signature(class_name, method_name)
      write(id: json[:id], result: result)
    when "rubbit.fetchMethods"
      class_name = params[:arguments][0]
      result = fetch_methods(class_name)
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

  def resolve_signature(class_name, method_name)
    begin
      genv = @core.genv
      return nil unless genv

      # cpath は Symbol の配列として構築 (例: "Net::HTTP" -> [:Net, :HTTP])
      if class_name.nil? || class_name == "" || class_name == "Object"
        cpath = [:Object]
      else
        cpath = class_name.split('::').reject(&:empty?).map(&:to_sym)
      end

      method_sym = method_name.to_sym
      
      # 継承チェーンに沿ってメソッドを探す
      base_mod = genv.resolve_cpath(cpath)
      [false, true].each do |singleton|
        genv.each_superclass(base_mod, singleton) do |mod, _singleton|
          begin
            me = mod.methods[singleton][method_sym]
            next unless me && me.exist?
            
            # 定義情報を取得 (defs, decls の順)
            mdef = (me.defs.to_a.first || me.decls.to_a.first) rescue nil
            next unless mdef
            
            # 実際の定義場所 (Kernel, Enumerable 等) を特定
            defined_in = mod.show_cpath
            
            sep = singleton ? "." : "#"
            
            # シグネチャの文字列表記
            # decls の場合は show ではなく method_types などを見る必要がある場合があるが、
            # もし show が定義されていればそれを使う
            sig_text = mdef.respond_to?(:show) ? mdef.show : method_name.to_s
            signature = "#{defined_in}#{sep}#{sig_text}"

            return {
              signature: signature,
              className: defined_in,
              methodName: method_name,
              separator: sep
            }
          rescue
          end
        end
      end
    rescue => e
    end
    nil
  end

  def fetch_methods(class_name)
    begin
      genv = @core.genv
      return [] unless genv

      if class_name.nil? || class_name == "" || class_name == "Object"
        cpath = [:Object]
      else
        cpath = class_name.split('::').reject(&:empty?).map(&:to_sym)
      end

      mod = genv.resolve_cpath(cpath)
      return [] unless mod

      results = []
      
      # 継承チェーンを辿ってメソッドを収集
      [false, true].each do |singleton|
        genv.each_superclass(mod, singleton) do |m, _s|
          begin
            sep = singleton ? "." : "#"
            m_hash = m.methods[singleton]
            next unless m_hash

            m_hash.each do |mid, me|
              # すでに同名のメソッドが見つかっている場合はスキップ（オーバーライド考慮）
              next if results.any? { |r| r[:methodName] == mid.to_s }
              
              mdef = (me.defs.to_a.first || me.decls.to_a.first) rescue nil
              owner = m.show_cpath
              
              results << {
                methodName: mid.to_s,
                candidates: ["#{owner}#{sep}#{mid}"]
              }
            end
          rescue
          end
        end
      end
      
      # メソッド名でユニークにしてソート
      return results.uniq { |r| r[:methodName] }.sort_by { |r| r[:methodName] }
    rescue => e
    end
    []
  end
end
