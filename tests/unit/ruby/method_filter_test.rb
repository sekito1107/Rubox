require 'minitest/autorun'
require_relative '../../../src/ruby/method_filter'

class TestMethodFilter < Minitest::Test
  def setup
    @filter = MethodFilter.new
  end

  def test_既存のインスタンスメソッド

    assert @filter.valid?("String", "gsub")
    assert @filter.valid?("Array", "each")
  end

  def test_ゴーストメソッド

    refute @filter.valid?("String", "each_slice")
    refute @filter.valid?("Integer", "unknown_method")
  end

  def test_継承メソッド

    # StringはComparable、Enumerableの扱いを確認
    assert @filter.valid?("String", "<=>")
    
    # ArrayはEnumerableをincludeしている
    assert @filter.valid?("Array", "each_slice")
  end



  def test_シングルトンメソッド
    assert @filter.valid?("File", "join", singleton: true)
    refute @filter.valid?("File", "join", singleton: false) # File#join は存在しない
  end


  def test_存在しないクラス

    # 未知のクラスは安全側に倒して true を返す
    assert @filter.valid?("NonExistentClass", "foo")
  end

  def test_定数パス解決

    assert @filter.valid?("Net::HTTP", "get", singleton: true)
  end

  def test_プライベートメソッド
    # puts は Kernel のプライベートメソッド
    assert @filter.valid?("Object", "puts")
    assert @filter.valid?("Kernel", "puts")
  end

  def test_キャッシュ機構


    # 1回目の呼び出し
    assert @filter.valid?("String", "reverse")
    
    # 2回目 (キャッシュヒット)
    assert @filter.valid?("String", "reverse")
    
    # 別メソッド (同じキャッシュセットを利用)
    assert @filter.valid?("String", "upcase")
  end
end
