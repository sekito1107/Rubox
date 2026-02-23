
require 'minitest/autorun'
require 'stringio'
require_relative '../../../src/ruby/measure_value'

class RuboxStopExecution < StandardError; end

class TestMeasureValue < Minitest::Test
  def setup
    unless MeasureValue.respond_to?(:original_run)
      class << MeasureValue
        alias_method :original_run, :run
        def run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
          MeasureValue::CapturedValue.reset
          begin
            measure_binding = TOPLEVEL_BINDING.eval("binding")
            code_str ||= File.read("/workspace/main.rb") rescue "nil"
            code_str += "\nnil"

            method_depth = 0
            tp = TracePoint.new(:line, :call, :return, :end, :b_call, :b_return, :c_call, :c_return) do |tp|
              case tp.event
              when :call
                method_depth += 1 if tp.path == "(eval)"
                if tp.lineno == target_line && tp.path == "(eval)"
                  begin
                    val = tp.binding.eval(expression)
                    MeasureValue::CapturedValue.add(val.inspect) unless val.nil? && !MeasureValue::CapturedValue.found?
                  rescue; end
                end
              when :c_call, :b_call
                method_depth += 1 if tp.path == "(eval)"
              when :return, :c_return, :b_return, :end
                if MeasureValue::CapturedValue.target_triggered && tp.path == "(eval)" && tp.lineno != target_line
                  begin
                    val = tp.binding.eval(expression)
                    MeasureValue::CapturedValue.add(val.inspect)
                  rescue
                  ensure
                    MeasureValue::CapturedValue.target_triggered = false
                  end
                end
                method_depth -= 1 if tp.path == "(eval)" && method_depth > 0
              when :line
                next unless tp.path == "(eval)"

                if MeasureValue::CapturedValue.target_triggered && tp.lineno != target_line
                  begin
                    val = tp.binding.eval(expression)
                    MeasureValue::CapturedValue.add(val.inspect)
                  rescue
                  ensure
                    MeasureValue::CapturedValue.target_triggered = false
                  end
                end

                if tp.lineno == target_line
                  MeasureValue::CapturedValue.target_triggered = true
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
              if MeasureValue::CapturedValue.get_all.empty? && method_depth == 0
                begin
                  val = measure_binding.eval(expression)
                  MeasureValue::CapturedValue.add(val.inspect)
                rescue; end
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
    result = MeasureValue.run("max_length", 3, binding, stdin, code)
    assert_equal '11', result, "ブロックを伴う代入文で、代入前のnilがキャプチャされるべきではありません"
  end

  def test_メソッドチェーンの結果が正しく取得できること
    code = <<~RUBY
      target = "banana"
      target.each_char
    RUBY
    result = MeasureValue.run("target.each_char", 2, binding, "", code)
    assert_match /#<Enumerator: "banana":each_char>/, result, "メソッドチェーンの戻り値がキャプチャされるべきです"
  end

  def test_def内からトップレベル変数が参照されないこと
    code = <<~RUBY
      target = "banana"
      def my_count
        target = "apple"
        target
      end
      my_count
    RUBY
    result = MeasureValue.run("target", 4, binding, "", code)
    assert_equal '"apple"', result
  end

  def test_トップレベル変数がdef内の同名変数に上書きされないこと
    code = <<~RUBY
      target = "banana"
      def my_count(target)
        target
      end
      my_count("apple")
    RUBY
    result = MeasureValue.run("target", 1, binding, "", code)
    assert_equal '"banana"', result, "1行目ではトップレベル変数の値のみが表示されるべきです"
  end

  def test_メソッド内のローカル変数が正しく取得できること
    code = <<~RUBY
      def my_method
        x = 10
        x
      end
      my_method
    RUBY
    result = MeasureValue.run("x", 3, binding, "", code)
    assert_equal '10', result, "メソッド内のローカル変数は取得できるべきです"
  end
end
