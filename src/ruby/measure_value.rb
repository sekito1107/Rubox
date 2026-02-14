module MeasureValue
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

  MAX_CAPTURES = 10

  def self.run(expression, target_line, user_binding)
    CapturedValue.reset
    
    begin
      # Measure Value 用に独立したBindingを作成
      measure_binding = TOPLEVEL_BINDING.eval("binding")
      
      # 最新のコードを読み込む
      if File.exist?("/workspace/main.rb")
        code_str = File.read("/workspace/main.rb") + "\nnil"

        tp = TracePoint.new(:line, :call, :return, :class, :end, :b_call, :b_return) do |tp|
          next unless tp.path == "(eval)"

          if tp.lineno == target_line && !CapturedValue.target_triggered && tp.event != :call && tp.event != :return
            CapturedValue.target_triggered = true
            next
          end

          if CapturedValue.target_triggered
            begin
              val = tp.binding.eval(expression)
              CapturedValue.add(val)
              
              CapturedValue.target_triggered = false
              
              if CapturedValue.count >= MAX_CAPTURES
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
          # 正常停止
        rescue => e
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
        results.join(", ")
      else
        ""
      end
    rescue => e
      if CapturedValue.found?
        CapturedValue.get_all.map(&:inspect).join(", ")
      else
        "(Error: #{e.message})"
      end
    ensure
      CapturedValue.reset
    end
  end
end
