module MeasureValue
  class CapturedValue
    @vals = [] # [ [RawValue, InspectString], ... ]
    @target_triggered = false
    @target_dirty = false
    class << self
      attr_accessor :target_triggered, :target_dirty
      def add(v)
        inspected = v.inspect
        # 前回の値（RawValue）とオブジェクトとして等しく、かつ文字列としても等しければスキップ
        return if !@vals.empty? && @vals.last[0] == v && @vals.last[1] == inspected
        val_to_save = (v.is_a?(Numeric) || v.is_a?(Symbol) || v.nil? || v.is_a?(TrueClass) || v.is_a?(FalseClass)) ? v : (v.dup rescue v)
        @vals << [val_to_save, inspected]
      end
      def get_all
        results = @vals.map { |v| v[1] }
        # 初回が空値(nil/[]/)で、かつ後続に値がある場合は、初期状態ノイズとして除去
        # 文字列の前後の空白を考慮
        if results.size > 1 && results.first.strip =~ /\A(nil|\[\s*\])\z/
          results.shift
        end
        results
      end
      def found?; !@vals.empty?; end
      def reset; @vals = []; @target_triggered = false; @target_dirty = false; end
    end
  end

  def self.sanitize_expression(expr)
    require 'ripper'
    sexp = Ripper.sexp(expr)
    return expr unless sexp && sexp[0] == :program
    
    body = sexp[1][0]
    return expr unless body.is_a?(Array)

    # 副作用のある式から安全な変数名（LHS）を抽出
    extracted = analyze_lhs(body, expr)
    extracted || expr
  rescue
    expr
  end

  def self.analyze_lhs(body, original_expr)
    case body[0]
    when :assign, :massign, :opassign
      # a = ..., a += ...
      match = original_expr.match(/\A(.*?)(?:\+|-|\*|\/|%|\*\*|&|\||\^|<<|>>|&&|\|\|)?=/)
      if match
        lhs = match[1].strip
        return (body[0] == :massign) ? "[#{lhs}]" : lhs
      end
    when :binary
      # lines << ...
      return extract_node_name(body[1]) if body[2] == :<<
    when :method_add_arg, :call
      # lines.push(...), lines.concat(...)
      # レシーバ部分を特定
      call_node = (body[0] == :method_add_arg) ? body[1] : body
      if call_node[0] == :call || call_node[0] == :method_add_arg
        method_name_node = call_node[3] || (call_node[0] == :method_add_arg ? call_node[1][3] : nil)
        method_name = method_name_node ? method_name_node[1] : nil
        
        # 破壊的メソッドのホワイトリスト（または ! 付き）
        destructive = ["push", "concat", "insert", "delete", "update", "replace", "clear", "shift", "unshift"]
        if method_name && (method_name.end_with?("!") || destructive.include?(method_name))
          return extract_node_name(call_node[1])
        end
      end
    end
    nil
  end

  def self.extract_node_name(node)
    return nil unless node.is_a?(Array)
    case node[0]
    when :vcall, :var_ref
      # [:vcall, [:@ident, "name", ...]]
      return node[1][1]
    when :@ident
      return node[1]
    end
    nil
  end

  def self.run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
    expression = sanitize_expression(expression)
    CapturedValue.reset
    begin
      old_verbose, $VERBOSE = $VERBOSE, nil
      measure_binding = TOPLEVEL_BINDING.eval("binding")
      code_str ||= File.read("/workspace/main.rb") rescue "nil"
      code_str += "\nnil"

      method_depth = 0
      last_lineno = 0
      target_line_depth = nil

      # キャプチャ実行の共通処理
      capture_and_report = proc do |binding|
        next if binding.nil?
        begin
          val = binding.eval(expression)
          unless val.nil? && !CapturedValue.found?
            # ここでの val は生の状態。CapturedValue.add 内で一回だけ inspect される。
            CapturedValue.add(val)
          end
        rescue
        end
      end

      last_line_binding = nil

      tp = TracePoint.new(:line, :call, :return, :end, :b_call, :b_return, :c_call, :c_return) do |tp|
        next unless tp.path == "(eval)"
        
        # 1. 深度・バインディング管理
        case tp.event
        when :call, :b_call, :c_call; method_depth += 1
        when :return, :b_return, :c_return, :end; method_depth -= 1 if method_depth > 0
        end
        last_line_binding = tp.binding if tp.binding

        # 2. 回収（トリガー後の確定タイミング）
        if CapturedValue.target_triggered && CapturedValue.target_dirty
          # 確定とみなす条件:
          # - 完全な別行に移動した
          # - 反復の区切り（b_return: ブロック終了）
          # - スコープを抜けた (method_depth < start_depth)
          is_departure = (tp.lineno != target_line && method_depth <= target_line_depth) || 
                         (tp.event == :b_return && method_depth <= target_line_depth) ||
                         (method_depth < target_line_depth)

          if is_departure
            capture_and_report.call(tp.binding || last_line_binding)
            CapturedValue.target_dirty = false # 回収したので一旦クリーンに
            
            # ターゲット行以外に移動した、または上の階層に戻ったならトリガー解除
            if tp.lineno != target_line || method_depth < target_line_depth
              CapturedValue.target_triggered = false
            end
          end
        end

        # 3. トリガーと状態管理
        if tp.lineno == target_line
          if tp.event == :line
            CapturedValue.target_triggered = true
            target_line_depth = method_depth
            # Line開始時はクリーン（まだ何も実行していない）
            CapturedValue.target_dirty = false
          else
            # Line内で何らかの命令（call等）が動いたなら、それは「結果が出る可能性のある状態」
            CapturedValue.target_dirty = true
          end
        end

        last_lineno = tp.lineno
      end

      old_stdin, old_stdout = $stdin, $stdout
      measure_binding.eval("require 'stringio'; $stdin = StringIO.new(#{stdin_str.inspect})") rescue nil
      measure_binding.eval("$stdout = StringIO.new") rescue nil
      
      begin
        tp.enable do
          measure_binding.eval(code_str, "(eval)")
        end
      rescue RuboxStopExecution
      rescue
      ensure
        tp.disable if tp
        # 最後にトリガーが残っていれば回収（最終行対策）
        if CapturedValue.target_triggered
           capture_and_report.call(measure_binding)
        end
        $stdin, $stdout = old_stdin, old_stdout
      end
    rescue
    ensure
      $VERBOSE = old_verbose
      CapturedValue.target_triggered = false
    end
    CapturedValue.get_all.uniq.join(", ")
  end
end
