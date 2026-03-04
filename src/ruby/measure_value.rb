require 'stringio'

module MeasureValue
  class CapturedValue
    def self.inspect_and_add(vals, v)
      inspected = v.inspect rescue "???"
      val_to_save = (v.is_a?(Numeric) || v.is_a?(Symbol) || v.nil? || v.is_a?(TrueClass) || v.is_a?(FalseClass)) ? v : (v.dup rescue v)
      vals << [val_to_save, inspected]
    end

    def self.format_all(vals)
      return nil if vals.empty?
      results = vals.map { |v| v[1] }
      # 初期化直後のnil/空配列ノイズを除去
      if results.size > 1 && results.first.strip =~ /\A(nil|\[\s*\])\z/
        results.shift
      end
      results.join(", ")
    end
  end

  def self.sanitize_expression(expr)
    require 'ripper'
    sexp = Ripper.sexp(expr)
    return expr unless sexp && sexp[0] == :program
    body = sexp[1][0]
    return expr unless body.is_a?(Array)
    extracted = analyze_lhs(body, expr)
    extracted || expr
  rescue
    expr
  end

  def self.analyze_lhs(body, original_expr)
    case body[0]
    when :assign, :massign, :opassign
      match = original_expr.match(/\A(.*?)(?:\+|-|\*|\/|%|\*\*|&|\||\^|<<|>>|&&|\|\|)?=/)
      if match
        lhs = match[1].strip
        return (body[0] == :massign) ? "[#{lhs}]" : lhs
      end
    when :binary
      return extract_node_name(body[1]) if body[2] == :<<
    when :method_add_arg, :call
      call_node = (body[0] == :method_add_arg) ? body[1] : body
      if call_node[0] == :call || call_node[0] == :method_add_arg
        method_name_node = call_node[3] || (call_node[0] == :method_add_arg ? call_node[1][3] : nil)
        method_name = method_name_node ? method_name_node[1] : nil
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
      return node[1][1]
    when :@ident
      return node[1]
    end
    nil
  end

  # 対象行コードのASTを解析し、「内側のブロック（スキップすべきb_call/b_return）の数」を返す
  # ルート（トップレベル）の method_add_block はカウントしない（これがループ本体）
  # 内部にネストした method_add_block はカウントする（式の一部として評価されるブロック）
  def self.count_inner_blocks(code_line)
    require 'ripper'
    sexp = Ripper.sexp(code_line.to_s)
    return 0 unless sexp && sexp[1]
    walk_for_inner_blocks(sexp[1], true)
  rescue
    0
  end

  def self.walk_for_inner_blocks(nodes, is_root = false)
    return 0 unless nodes.is_a?(Array)
    nodes.sum do |node|
      next 0 unless node.is_a?(Array)
      if node[0] == :method_add_block
        if is_root
          # ルートのブロック自体はカウントしない、その中の内部ブロックだけ探す
          walk_for_inner_blocks(node[1..])
        else
          # 内部ブロック = スキップ対象
          1 + walk_for_inner_blocks(node[1..])
        end
      elsif node[0].is_a?(Symbol)
        walk_for_inner_blocks(node[1..], false)
      else
        0
      end
    end
  end

  def self.run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
    final_result = ""
    begin
      expression = sanitize_expression(expression)
      old_verbose, $VERBOSE = $VERBOSE, nil

      vals = []
      pending_origin_depth = nil
      last_binding = nil
      method_depth = 0

      # 対象行コードの1行目を取得してAST解析
      target_line_code = (code_str || "").lines[target_line - 1]&.strip || ""
      # その行に含まれる「内側ブロック」の数 = スキップすべき b_return の数
      skip_b_returns = count_inner_blocks(target_line_code)
      # 現在のイテレーション内でスキップ済みの b_return 数
      b_return_count_in_iter = 0

      capture_and_report = proc do |binding|
        next if binding.nil?
        begin
          val = binding.eval(expression)
          CapturedValue.inspect_and_add(vals, val)
        rescue => e
          $stderr.puts "[EVAL ERROR] #{e.message}"
        end
      end

      tp = TracePoint.new(:line, :call, :return, :b_call, :b_return, :end) do |tp|
        next if tp.path == "/src/measure_value.rb"

        case tp.event
        when :call, :b_call; method_depth += 1
        when :return, :b_return, :end; method_depth -= 1 if method_depth > 0
        end

        if tp.event == :line && tp.lineno == target_line
          if pending_origin_depth.nil?
            pending_origin_depth = method_depth
            b_return_count_in_iter = 0
          end
          last_binding = tp.binding if method_depth <= pending_origin_depth
        end

        if pending_origin_depth
          if tp.event == :line && tp.lineno != target_line && method_depth <= pending_origin_depth
            capture_and_report.call(last_binding)
            pending_origin_depth = nil
            b_return_count_in_iter = 0
          elsif tp.event == :b_call && tp.lineno == target_line && skip_b_returns == 0
            pending_origin_depth = method_depth if method_depth > pending_origin_depth
          elsif tp.event == :b_return && tp.path == "(eval)"
            if skip_b_returns == 0
              if method_depth <= pending_origin_depth
                capture_and_report.call(last_binding)
                pending_origin_depth = nil
                b_return_count_in_iter = 0
              end
            elsif b_return_count_in_iter < skip_b_returns
              b_return_count_in_iter += 1
            elsif method_depth < pending_origin_depth
              capture_and_report.call(last_binding)
              pending_origin_depth = nil
              b_return_count_in_iter = 0
            end
          end
        end
      end

      # 実行環境のセットアップ
      old_stdin, old_stdout = $stdin, $stdout
      $stdin = StringIO.new(stdin_str.to_s)
      $stdout = StringIO.new

      measure_binding = TOPLEVEL_BINDING.eval("binding")
      actual_code = (code_str || "nil") + "\n# end"

      begin
        tp.enable do
          measure_binding.eval(actual_code, "(eval)")
        end
      rescue RuboxStopExecution
      rescue => e
        # 実行時エラーもキャプチャ結果の一部として許容
        $stderr.puts "[MEASURE ERROR] #{e.message}"
      ensure
        tp.disable if tp
        capture_and_report.call(last_binding) if pending_origin_depth
        $stdin, $stdout = old_stdin, old_stdout
      end

      formatted = CapturedValue.format_all(vals)
      final_result = formatted || ""
    rescue => e
      final_result = "ERROR: #{e.message}"
    ensure
      $VERBOSE = old_verbose rescue nil
    end
    final_result
  end
end
