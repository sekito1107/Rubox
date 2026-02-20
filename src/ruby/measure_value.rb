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

  def self.run(expression, target_line, user_binding, stdin_str = "")
    CapturedValue.reset
    begin
      measure_binding = TOPLEVEL_BINDING.eval("binding")
      code_str = File.read("/workspace/main.rb") rescue "nil"
      code_str += "\nnil"

      method_depth = 0
      tp = TracePoint.new(:line, :call, :return, :end, :b_call, :b_return, :c_call, :c_return) do |tp|
        case tp.event
        when :call
          method_depth += 1 if tp.path == "(eval)"
          # メソッド引数のキャプチャ (def行がターゲットの場合)
          if tp.lineno == target_line && tp.path == "(eval)"
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val.inspect) unless val.nil? && !CapturedValue.found?
            rescue; end
          end
        when :c_call, :b_call
          method_depth += 1 if tp.path == "(eval)"
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

          # ターゲット行に到達 (即時評価はせず、次行/return で値を取得する)
          if tp.lineno == target_line
            CapturedValue.target_triggered = true
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
      CapturedValue.target_triggered = false
    end
    CapturedValue.get_all.uniq.join(", ")
  end
end
