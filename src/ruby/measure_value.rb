module MeasureValue
  class CapturedValue
    @vals = []
    @target_triggered = false
    class << self
      attr_accessor :target_triggered
      def add(v); @vals << v; end
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
      # アクティブな行を追加してTracePointを確実に踏ませる（特に最終行対策）
      code_str += "\nnil"

      tp = TracePoint.new(:line, :return, :end) do |tp|
        next unless tp.path == "(eval)"
        
        # 1. ターゲット行に到達した場合
        if tp.lineno == target_line && tp.event == :line
          # 未来の呼び出し（定義より後の行からの呼び出し）を無視する
          begin
            eval_locs = caller_locations.select { |l| l.path == "(eval)" }
            current_caller = eval_locs.find { |l| l.lineno != target_line }
            is_future = current_caller && current_caller.lineno > target_line
          rescue
            is_future = false
          end

          unless is_future
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val.inspect.to_s)
              CapturedValue.target_triggered = true
            rescue
            end
          end

        # 2. ターゲット行を抜けた直後のイベント (gets等の最終値キャプチャ用)
        elsif CapturedValue.target_triggered && tp.lineno != target_line
          begin
            val = tp.binding.eval(expression)
            inspect_val = val.inspect.to_s
            # 最後に追加した値と異なる（実行中に変化した）場合のみ追加
            if inspect_val != CapturedValue.get_all.last
              CapturedValue.add(inspect_val)
            end
          rescue
          ensure
            raise RubbitStopExecution
          end

        # 3. ターゲット行を一度も踏まずに通り過ぎた場合 (最適化等)
        elsif !CapturedValue.target_triggered && tp.lineno > target_line
          begin
            val = tp.binding.eval(expression)
            CapturedValue.add(val.inspect.to_s)
          rescue
          ensure
            raise RubbitStopExecution
          end
        end
      end

      # 実行環境のセットアップ（Stdinの反映とStdoutの抑制）
      measure_binding.eval("require 'stringio'; $stdin = StringIO.new(#{stdin_str.inspect})") rescue nil
      measure_binding.eval("$stdout = StringIO.new") rescue nil
      
      begin
        tp.enable do
          measure_binding.eval(code_str, "(eval)")
        end
      rescue RubbitStopExecution
      rescue
      ensure
        # 最後まで実行しても取れなかった場合のフォールバック
        if !CapturedValue.target_triggered
          begin
            val = measure_binding.eval(expression)
            CapturedValue.add(val.inspect.to_s)
          rescue
          end
        end
        tp.disable if tp
      end
    rescue
    ensure
      CapturedValue.target_triggered = false
    end
    
    # 重複を排除しつつ結合 (ループ等での nil, nil 対策)
    # uniq を使うと順序が維持される
    CapturedValue.get_all.uniq.join(", ")
  end
end
