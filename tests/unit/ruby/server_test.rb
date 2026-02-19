require 'minitest/autorun'
require 'ostruct'

module TypeProf
  module LSP
    class Text; end
  end
end

require_relative '../../../src/ruby/server'


class MockMethodDef
  attr_reader :show
  def initialize(name)
    @show = "def #{name}"
  end
end

class MockMethodEntry
  attr_reader :defs, :decls
  def initialize(name)
    @defs = [MockMethodDef.new(name)]
    @decls = []
  end
  def exist?; true; end
end

class MockModule
  attr_reader :name, :show_cpath
  
  def initialize(name, methods_map)
    @name = name
    @show_cpath = name
    @methods_map = methods_map
  end
  
  def methods
    # server.rb は m.methods[singleton] をチェックする
    @methods_map
  end

end

class MockGenv
  def resolve_cpath(cpath)
    # クラスを特定するダミーオブジェクトを返す
    MockModule.new(cpath.join("::"), {})
  end


  def each_superclass(mod, singleton)
    # 擬似的な継承ツリーを再現
    # String -> Object (-> Kernel) -> BasicObject
    if mod.name == "String" && !singleton
      # String自身の定義
      yield create_mock_module("String", [:gsub, :length]), false
      
      # 誤って混入した Enumerable (Ghost)
      yield create_mock_module("Enumerable", [:each_slice]), false

      # Object
      yield create_mock_module("Object", [:to_s]), false
      
    elsif mod.name == "Array" && !singleton
       # Array自身の定義
       yield create_mock_module("Array", [:push]), false
       # Enumerable (Valid)
       yield create_mock_module("Enumerable", [:each_slice]), false
    end
  end

  private

  def create_mock_module(name, method_names)
    # methodsハッシュ { singleton => methods_map }
    # methods_map { :メソッド名 => メソッドエントリ }

    
    m_hash = method_names.map { |m| [m, MockMethodEntry.new(m)] }.to_h
    
    MockModule.new(name, { false => m_hash, true => {} })
  end
end

class MockCore
  def genv
    MockGenv.new
  end
end

class TestServer < Minitest::Test
  def setup
    @core = MockCore.new
    @server = Server.new(@core)
  end

  def test_fetch_methods_Stringのゴーストメソッドをフィルタする

    # String のメソッド一覧を取得
    # モックでは Enumerable#each_slice が返るように設定されているが、
    # Server内の MethodFilter がこれを弾くはず (String#each_slice は存在しないため)
    
    results = @server.send(:fetch_methods, "String")
    
    method_names = results.map { |r| r[:methodName] }


    assert_includes method_names, "gsub"
    assert_includes method_names, "to_s"

    refute_includes method_names, "each_slice", "String#each_slice は除外されるべき"
  end

  def test_fetch_methods_Arrayの正当な継承メソッドを許可する

    # Array のメソッド一覧を取得
    # Array は Enumerable を include しているので each_slice は有効
    
    results = @server.send(:fetch_methods, "Array")
    
    method_names = results.map { |r| r[:methodName] }

    
    assert_includes method_names, "push"
    assert_includes method_names, "each_slice", "Array#each_slice は存在するべき"

  end
end
