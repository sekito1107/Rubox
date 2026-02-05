# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Code Execution", type: :system do
  before do
    driven_by(:selenium_chrome_headless) do |options|
      options.add_argument("--no-sandbox")
      options.add_argument("--disable-dev-shm-usage")
      options.add_argument("--disable-gpu")
      options.add_argument("--window-size=1400,1400")
    end
  end

  it "Rubyコードを実行して結果を表示する" do
    visit root_path

    # Ruby WASM の初期化を待機
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # エディタをクリアしてコードを入力
    # Monaco Editor はモデル経由でアクセスする必要があるため、JSで直接値をセットする
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('puts "Hello from WASM!"');
      }
    JS

    # Runボタンをクリック
    click_button "Run"

    # 出力がターミナルに表示されることを検証
    expect(page).to have_content("Hello from WASM!", wait: 10)
  end

  it "Rubyのエラーを適切にハンドリングする" do
    visit root_path

    # Ruby WASM の初期化を待機
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # エラーになるコードをセット
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('undefined_variable');
      }
    JS

    # Runボタンをクリック
    click_button "Run"

    # エラーメッセージが表示されることを検証
    expect(page).to have_content("Error:", wait: 10)
  end

  it "ターミナルの出力をクリアする" do
    visit root_path

    # Ruby WASM の初期化を待機
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # Clearボタンをクリック
    click_button "Clear"

    # ターミナルが空になっている（初期メッセージが消えている）ことを検証
    expect(page).not_to have_content("Ruby WASM ready!")
    expect(page).not_to have_content("//")
  end
end
