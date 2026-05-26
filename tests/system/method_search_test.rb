require "test_helper"

class MethodSearchTest < SystemTest
  def test_クラスのメソッド一覧とインクリメンタルサーチが正しく機能すること
    visit "/"
    wait_wasm_loading
    wait_analyzer_ready

    assert_text "REFERENCE SEARCH"
    find("select").select("Array")
    assert_text "map"
    assert_text "find"
    find("input[placeholder='Search methods...']").fill_in(with: "find")
    assert_text "find"
    assert_no_text "map"
    assert_selector "a[href='https://docs.ruby-lang.org/ja/latest/method/Enumerable/i/find.html']"
  end

  def test_正常にメソッドがMETHODS_IN_USEに表示されること
    visit "/"
    wait_wasm_loading
    wait_analyzer_ready
    type_code("\"hello\".upcase")
    find("aside button", text: "Methods").click
    within "[data-testid='method-list']" do
      assert_text "upcase"
    end
  end

  def test_記述を消したらメソッドが表示されなくなること
    visit "/"
    wait_wasm_loading
    wait_analyzer_ready
    type_code("\"hello\".upcase")
    find("aside button", text: "Methods").click
    within "[data-testid='method-list']" do
      assert_text "upcase"
    end
    type_code("")
    assert_text "No methods detected yet."
  end

  def test_構文エラーが発生している状態でも正常な行のメソッドがMETHODS_IN_USEに表示されること
    visit "/"
    wait_wasm_loading
    wait_analyzer_ready
    type_code("\"hello\".upcase\ndef incomplete_method_")
    find("aside button", text: "Methods").click
    within "[data-testid='method-list']" do
      assert_text "upcase"
    end
  end
end
