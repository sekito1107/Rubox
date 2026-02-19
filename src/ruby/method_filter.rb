require 'set'

# ランタイム検証を担う汎用フィルタクラス
# TypeProfが解析したメソッドが、実際にそのクラスで定義されているかを検証する
class MethodFilter
  def initialize
    # キャッシュ構造: { "ClassName:singleton/instance" => Set[:method1, :method2, ...] }
    @cache = {}
  end

  # メソッドが実際にそのクラスに存在するかを検証
  def valid?(class_name, method_name, singleton: false)
    klass = resolve_class(class_name)
    return true unless klass

    method_set = cached_methods(klass, singleton)
    method_set.include?(method_name.to_sym)
  end

  private

  # クラス名からクラスオブジェクトを取得
  def resolve_class(class_name)
    return nil if class_name.nil? || class_name.empty?

    # Objectは特別扱い (トップレベル定数解決の始点となるため)
    return Object if class_name == "Object"

    # ネストされたクラス名 (Net::HTTP など) を解決
    class_name.split('::').inject(Object) do |mod, name|
      mod.const_get(name)
    end
  rescue NameError
    nil
  end

  # クラスのメソッド一覧をキャッシュして取得
  def cached_methods(klass, singleton)
    type = singleton ? 's' : 'i'
    cache_key = "#{klass.name || klass.to_s}:#{type}"
    
    @cache[cache_key] ||= if singleton
      # シングルトンメソッド (クラスメソッド)
      Set.new(klass.singleton_methods)
    else
      # インスタンスメソッド (継承含む、privateメソッドも含む)
      Set.new(klass.instance_methods + klass.private_instance_methods)
    end

  end
end
