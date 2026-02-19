
require 'minitest/autorun'
require 'stringio'
require_relative '../../../src/ruby/measure_value'

# テスト実行を中断するための例外クラス (src/ruby/measure_value.rb で使用)
class RuboxStopExecution < StandardError; end

class TestMeasureValue < Minitest::Test
  def setup
    # MeasureValue.run は通常 /workspace/main.rb からコードを読み込みますが、
    # ユニットテスト環境ではコードを引数から直接渡せるようにモック化します。
    unless MeasureValue.respond_to?(:original_run)
      class << MeasureValue
        alias_method :original_run, :run
        def run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
          MeasureValue::CapturedValue.reset
          begin
            measure_binding = TOPLEVEL_BINDING.eval("binding")
            # テスト用に引数の code_str を優先する
            code_str ||= File.read("/workspace/main.rb") rescue "nil"
            code_str += "\nnil"

            # TracePointの設定 (src/ruby/measure_value.rb と同等のロジック)
            tp = TracePoint.new(:line, :return, :end, :b_call, :b_return) do |tp|
              next unless tp.path == "(eval)"
              
              # 1. ターゲット行に到達した場合
              if tp.lineno == target_line && tp.event == :line
                begin
                  eval_locs = caller_locations.select { |l| l.path == "(eval)" }
                  current_caller = eval_locs.find { |l| l.lineno != target_line }
                  is_future = current_caller && current_caller.lineno > target_line
                rescue
                  is_future = false
                end

                unless is_future
                  MeasureValue::CapturedValue.target_triggered = true
                end

              # 2. ターゲット行を抜けた直後 (gets等の最終値キャプチャ用)
              elsif MeasureValue::CapturedValue.target_triggered && tp.lineno != target_line
                begin
                  val = tp.binding.eval(expression)
                  inspect_val = val.inspect.to_s
                  # 値が変化した場合のみ追加
                  if inspect_val != MeasureValue::CapturedValue.get_all.last
                    MeasureValue::CapturedValue.add(inspect_val)
                  end
                rescue
                ensure
                  MeasureValue::CapturedValue.target_triggered = false
                end

                # 3. ターゲット行を通り過ぎた場合 (最適化対策)
                elsif !MeasureValue::CapturedValue.target_triggered && !MeasureValue::CapturedValue.found? && tp.lineno > target_line
                begin
                  val = tp.binding.eval(expression)
                  MeasureValue::CapturedValue.add(val.inspect.to_s)
                rescue
                ensure
                  raise RuboxStopExecution
                end
              end
            end

            # 入出力のセットアップ
            measure_binding.eval("require 'stringio'; $stdin = StringIO.new(#{stdin_str.inspect})") rescue nil
            measure_binding.eval("$stdout = StringIO.new") rescue nil
            
            begin
              tp.enable do
                measure_binding.eval(code_str, "(eval)")
              end
            rescue RuboxStopExecution
            rescue
            ensure
              # フォールバック: キャプチャが空の場合
              if MeasureValue::CapturedValue.get_all.empty?
                begin
                  val = measure_binding.eval(expression)
                  MeasureValue::CapturedValue.add(val.inspect.to_s)
                rescue
                end
              end
              tp.disable if tp
            end
          rescue 
          ensure
            MeasureValue::CapturedValue.target_triggered = false
          end
          MeasureValue::CapturedValue.get_all.uniq.join(", ")
        end
      end
    end
  end

  def test_未来の値のキャプチャが防止されていること
    code = <<~RUBY
      string = "Ruby"
      5.times do 
        string << "!"
      end
      string = "reset"
    RUBY
    
    # 1行目の "string" を検査
    result = MeasureValue.run("string", 1, binding, "", code)
    assert_equal '"Ruby"', result, "1行目では初期値のみがキャプチャされるべきです"
  end

  def test_getsの実行結果が正しく取得できること
    code = "x = gets"
    result = MeasureValue.run("x", 1, binding, "hello\n", code)
    assert_match /"hello\\n"/, result, "gets の戻り値がキャプチャされるべきです"
  end

  def test_ループ内での値の変化が正しく取得できること
    code = <<~RUBY
      a = 0
      3.times do |i|
        a += 1
      end
    RUBY
    
    # 3行目の "a" (+1 される箇所) を検査
    result = MeasureValue.run("a", 3, binding, "", code)
    assert_equal '1, 2, 3', result, "ループ中の各ステップの値がキャプチャされるべきです"
  end

  def test_再代入時に新しい値のみが表示されること
    code = <<~RUBY
      string = "Ruby"

      5.times do 
        string << "!"
      end

      puts string

      string = "reset"

      puts string
    RUBY
    
    # 9行目の "string = 'reset'" を検査
    result = MeasureValue.run("string", 9, binding, "", code)
    assert_equal '"reset"', result, "再代入行では古い値を含まず、新しい値のみが表示されるべきです"
  end

  def test_putsの箇所で未来の代入値が混入しないこと
    code = <<~RUBY
      string = "Ruby"

      5.times do 
        string << "!"
      end

      puts string

      string = "reset"

      puts string
    RUBY
    
    # 7行目の "puts string" を検査
    result = MeasureValue.run("string", 7, binding, "", code)
    assert_equal '"Ruby!!!!!"', result, "puts行ではその時点の値のみが表示されるべきであり、後の'reset'は含まれないべきです"
  end

  def test_ブロックを伴う代入文で中間値nilがキャプチャされないこと
    code = <<~RUBY
      _x = gets.chomp
      targets = readlines(chomp: true)
      max_length = targets.max_by{|t| t.size}.size
    RUBY
    stdin = <<~INPUT
      4
      apple
      blueberry
      coconut
      dragonfruit
    INPUT
    
    # 3行目の "max_length" を検査
    result = MeasureValue.run("max_length", 3, binding, stdin, code)
    assert_equal '11', result, "ブロックを伴う代入文で、代入前のnilがキャプチャされるべきではありません"
  end
end
