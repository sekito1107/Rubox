module MeasureValue
  class CapturedValue
    @vals = []
    @target_triggered = false
    class << self
      attr_accessor :target_triggered
      def add(v); v = v.to_s; @vals << v unless @vals.last == v; end
      def get_all; @vals; end
      def found?; !@vals.empty?; end
      def reset; @vals = []; @target_triggered = false; end
    end
  end

  def self.sanitize_expression(expr)
    require 'ripper'
    sexp = Ripper.sexp(expr)
    return expr unless sexp && sexp[0] == :program
    
    body = sexp[1][0]
    return expr unless body.is_a?(Array)

    if [:assign, :massign, :opassign].include?(body[0])
      match = expr.match(/\A(.*?)(?:\+|-|\*|\/|%|\*\*|&|\||\^|<<|>>|&&|\|\|)?=/)
      if match
        lhs = match[1].strip
        if body[0] == :massign
          return "[#{lhs}]"
        else
          return lhs
        end
      end
    end
    expr
  rescue
    expr
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
      pass_captured = false
      target_line_depth = nil

      # キャプチャ実行と状態更新の共通処理
      capture_and_report = proc do |binding|
        next if binding.nil?
        begin
          val = binding.eval(expression)
          unless val.nil? && !CapturedValue.found?
            CapturedValue.add(val.inspect)
          end
        rescue
        ensure
          CapturedValue.target_triggered = false
          pass_captured = true
        end
      end

      tp = TracePoint.new(:line, :call, :return, :end, :b_call, :b_return, :c_call, :c_return) do |tp|
        next unless tp.path == "(eval)"

        # 実行行が戻った場合（ループの先頭に戻った等）、新しい周回とみなしてキャプチャを再度有効にする
        if tp.event == :line || tp.event == :call || tp.event == :b_call
          if tp.lineno < last_lineno
            pass_captured = false
          end
          # ターゲット行かそれより前に戻った場合もリセット（ただし1周に1回のみ）
          if tp.lineno <= target_line && tp.lineno < last_lineno
            target_line_depth = nil
          end
        end

        case tp.event
        when :call, :b_call, :c_call
          method_depth += 1
          # エントリポイント（def行やブロック開始行）がターゲットの場合
          if tp.lineno == target_line && !pass_captured && tp.binding
            capture_and_report.call(tp.binding)
          end
        when :return, :b_return, :c_return, :end
          # ターゲット行を抜けた後の事後キャプチャ（同じ深度に戻った時）
          if CapturedValue.target_triggered && tp.lineno != target_line && (target_line_depth.nil? || method_depth == target_line_depth)
            capture_and_report.call(tp.binding)
          end
          method_depth -= 1 if method_depth > 0
        when :line
          # ターゲット行を抜けた直後の事後キャプチャ
          if CapturedValue.target_triggered && tp.lineno != target_line && (target_line_depth.nil? || method_depth == target_line_depth)
            capture_and_report.call(tp.binding)
          end

          if !pass_captured
            if tp.lineno == target_line
              CapturedValue.target_triggered = true
              target_line_depth = method_depth
            elsif last_lineno > 0 && last_lineno < target_line && tp.lineno > target_line
              # スキップされた場合の境界越えキャプチャ（ターゲット行を飛び越えた時）
              capture_and_report.call(tp.binding)
            end
          end
        end

        last_lineno = tp.lineno
      end

      measure_binding.eval("require 'stringio'; $stdin = StringIO.new(#{stdin_str.inspect})") rescue nil
      measure_binding.eval("$stdout = StringIO.new") rescue nil
      
      begin
        tp.enable do
          measure_binding.eval(code_str, "(eval)")
        end
      rescue RuboxStopExecution
      rescue
      ensure
        if CapturedValue.get_all.empty? && method_depth == 0
          begin
            val = measure_binding.eval(expression)
            CapturedValue.add(val.inspect)
          rescue; end
        end
        tp.disable if tp
      end
    rescue
    ensure
      $VERBOSE = old_verbose
      CapturedValue.target_triggered = false
    end
    CapturedValue.get_all.uniq.join(", ")
  end
end
