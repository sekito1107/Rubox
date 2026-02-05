# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Share Feature", type: :system do
  before do
    driven_by(:selenium_chrome_headless) do |options|
      options.add_argument("--no-sandbox")
      options.add_argument("--disable-dev-shm-usage")
      options.add_argument("--disable-gpu")
      options.add_argument("--window-size=1400,1400")
    end
  end

  it "ShareボタンでコードをURLに圧縮してコピーでき、そのURLから復元できること" do
    # ----------------------------------------------------------------
    # 1. コード作成と共有 (Share)
    # ----------------------------------------------------------------
    visit root_path

    # Ruby WASM の初期化を待機
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # クリップボードAPIをモック化 (権限エラー回避のため)
    page.execute_script(<<~JS)
      window.__lastCopiedText = null;
      if (!navigator.clipboard) navigator.clipboard = {};
      navigator.clipboard.writeText = async (text) => {
        window.__lastCopiedText = text;
        return Promise.resolve();
      };
    JS

    # エディタにコードをセット
    target_code = 'puts "Share Flow Test"'
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('#{target_code}');
      }
    JS

    # Shareボタンをクリック
    click_button "Share"

    # 通知が表示されることを確認
    expect(page).to have_content("URL copied to clipboard!", wait: 10)

    # モックからコピーされたURLを取得
    shared_url = page.evaluate_script("window.__lastCopiedText")
    expect(shared_url).to include("#code=")
    
    # ----------------------------------------------------------------
    # 2. ページ遷移と復元 (Restore)
    # ----------------------------------------------------------------
    
    # 一度 about:blank に遷移して状態をリセット
    visit "about:blank"
    
    # 生成された共有URLにアクセス
    visit shared_url

    # ページロードとWASM初期化を待機
    # ここでタイムアウトしやすいので長めに待つ
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # 非同期でのコード復元を待つ (ポーリング)
    restored_code = nil
    10.times do
      sleep 1
      restored_code = page.evaluate_script(<<~JS)
        (() => {
          const editor = window.monaco?.editor?.getEditors()[0];
          return editor ? editor.getValue() : "";
        })()
      JS
      break if restored_code == target_code
    end

    expect(restored_code).to eq(target_code)
  end

  it "復元後にリロードしても編集内容が維持されること (Consume-once)" do
    # ----------------------------------------------------------------
    # 1. コード作成と共有URL取得 (正規の手順)
    # ----------------------------------------------------------------
    visit root_path
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # クリップボードモック
    page.execute_script(<<~JS)
      window.__lastCopiedText = null;
      if (!navigator.clipboard) navigator.clipboard = {};
      navigator.clipboard.writeText = async (text) => {
        window.__lastCopiedText = text;
        return Promise.resolve();
      };
    JS

    target_code = 'puts "Consume Once Test"'
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('#{target_code}');
      }
    JS

    click_button "Share"
    expect(page).to have_content("URL copied to clipboard!", wait: 10)
    shared_url = page.evaluate_script("window.__lastCopiedText")

    # ----------------------------------------------------------------
    # 2. 共有URLにアクセス
    # ----------------------------------------------------------------
    visit "about:blank"
    visit shared_url
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # 復元確認 (ポーリング)
    restored_code = nil
    10.times do
      sleep 1
      restored_code = page.evaluate_script(<<~JS)
        (() => {
          const editor = window.monaco?.editor?.getEditors()[0];
          return editor ? editor.getValue() : "";
        })()
      JS
      break if restored_code == target_code
    end
    expect(restored_code).to eq(target_code)

    # ----------------------------------------------------------------
    # 3. Consume-once 検証
    # ----------------------------------------------------------------
    # URLハッシュが消えていること
    current_url = page.evaluate_script("window.location.href")
    expect(current_url).not_to include("#code=")

    # 編集してローカル保存
    edited_code = 'puts "Edited After Restore"'
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('#{edited_code}');
      }
    JS
    sleep 1.5 # Debounce待機

    # リロード
    visit "about:blank"
    visit root_path

    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # 編集内容が維持されていること
    reloaded_code = page.evaluate_script(<<~JS)
      (() => {
        const editor = window.monaco?.editor?.getEditors()[0];
        return editor ? editor.getValue() : "";
      })()
    JS

    expect(reloaded_code).to eq(edited_code)
  end
end
