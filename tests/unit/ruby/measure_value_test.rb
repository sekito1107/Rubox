
require 'minitest/autorun'
require 'stringio'
require_relative '../../../src/ruby/measure_value'

class RuboxStopExecution < StandardError; end

class TestMeasureValue < Minitest::Test
  def test_単純な代入文で値がキャプチャされること
    code = 'x = 100'
    result = MeasureValue.run("x", 1, binding, "", code)
    assert_equal "100", result
  end

  def test_ループ内でのスキップされた行の変数キャプチャ
    code = <<~RUBY
      3.times do |i|
        i
      end
    RUBY
    result = MeasureValue.run("i", 2, binding, "", code)
    assert_equal '0, 1, 2', result
  end

  def test_標準入力を伴うループ内での変数キャプチャ
    code = <<~RUBY
      n = gets.to_i
      lines = []
      n.times do |i|
        i
        lines << gets.chomp
      end
    RUBY
    stdin = "3\nline1\nline2\nline3\n"
    result = MeasureValue.run("i", 4, binding, stdin, code)
    assert_equal '0, 1, 2', result
  end

  def test_未来のループイテレーションや代入による値の混入が防止されていること
    code = <<~RUBY
      string = "Ruby".dup
      5.times do 
        string << "!"
      end
      string = "reset"
    RUBY
    # 1行目の時点では "Ruby" のみであるべき
    result = MeasureValue.run("string", 1, binding, "", code)
    assert_equal '"Ruby"', result
  end

  def test_再代入行で新しい値のみが表示されること
    code = <<~RUBY
      string = "old"
      string = "new"
    RUBY
    result = MeasureValue.run("string", 2, binding, "", code)
    assert_equal '"new"', result
  end

  def test_メソッド内のローカル変数が正しく取得できること
    code = <<~RUBY
      def my_method
        x = 42
        x
      end
      my_method
    RUBY
    result = MeasureValue.run("x", 3, binding, "", code)
    assert_equal '42', result
  end

  def test_ブロックを伴う代入文で中間状態のnilがキャプチャされないこと
    code = <<~RUBY
      items = ["apple", "banana"]
      longest = items.max_by do |item|
        item.length
      end
    RUBY
    result = MeasureValue.run("longest", 2, binding, "", code)
    assert_equal '"banana"', result
  end

  def test_getsの副作用が二重に実行されないこと
    code = <<~RUBY
      line1 = gets.chomp
      line2 = gets.chomp
    RUBY
    stdin = "first\nsecond\n"
    result = MeasureValue.run("line1", 1, binding, stdin, code)
    assert_equal '"first"', result
  end

  def test_ループ内でのミュータブルオブジェクトの追跡
    code = <<~RUBY
      a = "Ruby".dup
      3.times do
        a << "!"
      end
    RUBY
    # 3行目の "a << '!'" で a の値を追跡
    result = MeasureValue.run("a", 3, binding, "", code)
    assert_equal '"Ruby!", "Ruby!!", "Ruby!!!"', result
  end
end
