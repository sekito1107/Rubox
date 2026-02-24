require 'minitest/autorun'
require_relative '../../../src/ruby/measure_value'

class TestExpressionParser < Minitest::Test
  def test_単純代入の左辺抽出
    assert_equal 'a', MeasureValue.sanitize_expression('a = 1')
    assert_equal 'my_var', MeasureValue.sanitize_expression('my_var = "string"')
  end

  def test_自己代入の左辺抽出
    assert_equal 'a', MeasureValue.sanitize_expression('a += 1')
    assert_equal 'count', MeasureValue.sanitize_expression('count -= 10')
    assert_equal 'total', MeasureValue.sanitize_expression('total *= 2')
  end

  def test_多重代入の形式
    assert_equal '[x, y]', MeasureValue.sanitize_expression('x, y = [1, 2]')
  end

  def test_左シフト演算のレシーバ抽出
    assert_equal 'lines', MeasureValue.sanitize_expression('lines << "value"')
    assert_equal 'buffer', MeasureValue.sanitize_expression('buffer << gets.chomp')
  end

  def test_破壊的メソッド呼び出しのレシーバ抽出
    assert_equal 'items', MeasureValue.sanitize_expression('items.push(10)')
    assert_equal 'data', MeasureValue.sanitize_expression('data.concat(other)')
    assert_equal 'str', MeasureValue.sanitize_expression('str.strip!')
  end

  def test_副作用のない式はそのまま返す
    assert_equal 'x.times { puts i }', MeasureValue.sanitize_expression('x.times { puts i }')
    assert_equal 'a + b', MeasureValue.sanitize_expression('a + b')
    assert_equal 'items.map(&:to_i)', MeasureValue.sanitize_expression('items.map(&:to_i)')
  end

  def test_不正な構文は元の式を返す
    assert_equal 'a = ', MeasureValue.sanitize_expression('a = ')
    assert_equal '!!!', MeasureValue.sanitize_expression('!!!')
  end
end
