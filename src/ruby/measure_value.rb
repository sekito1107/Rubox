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

  def self.run(expression, target_line, user_binding, stdin_str = "")
    expression = sanitize_expression(expression)
    CapturedValue.reset
    begin
      old_verbose, $VERBOSE = $VERBOSE, nil
      measure_binding = TOPLEVEL_BINDING.eval("binding")
      code_str = File.read("/workspace/main.rb") rescue "nil"
      code_str += "\nnil"

      method_depth = 0
      tp = TracePoint.new(:line, :call, :return, :end, :b_call, :b_return, :c_call, :c_return) do |tp|
        case tp.event
        when :call, :b_call, :c_call
          method_depth += 1 if tp.path == "(eval)"
          # ターゲット行に到達した場合 (def行やブロック開始行がターゲットの場合、即座にキャプチャを試みる)
          if tp.lineno == target_line && tp.path == "(eval)"
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val.inspect) unless val.nil? && !CapturedValue.found?
            rescue; end
          end
        when :return, :c_return, :b_return, :end
          # メソッド/ブロック終了時: ターゲット行と異なる行でのみキャプチャ
          if CapturedValue.target_triggered && tp.path == "(eval)" && tp.lineno != target_line
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val.inspect)
            rescue
            ensure
              CapturedValue.target_triggered = false
            end
          end
          method_depth -= 1 if tp.path == "(eval)" && method_depth > 0
        when :line
          next unless tp.path == "(eval)"

          # ターゲット行を抜けた直後 (代入完了後の値を取得)
          if CapturedValue.target_triggered && tp.lineno != target_line
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val.inspect)
            rescue
            ensure
              CapturedValue.target_triggered = false
            end
          end

          # ターゲット行に到達、またはスキップされた可能性がある場合（ターゲット行を超えた最初の行）
          if !CapturedValue.target_triggered && tp.lineno >= target_line
            CapturedValue.target_triggered = true
            
            # スキップされた場合は即座に現在の行でキャプチャを試みる
            if tp.lineno > target_line
              begin
                val = tp.binding.eval(expression)
                CapturedValue.add(val.inspect)
              rescue
              ensure
                CapturedValue.target_triggered = false
              end
            end
          end
        end
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
