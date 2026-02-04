require "rails_helper"

RSpec.describe Layout::HeaderComponent, type: :component do
  it "ロゴ、アクションボタン、テーマ切替ボタンが表示されること" do
    render_inline(described_class.new)

    # ロゴの確認
    expect(page).to have_text("RubPad")
    expect(page).to have_text("v1.0 (MVP)")

    # ボタンの確認
    expect(page).to have_button("Share")
    expect(page).to have_button("Run")

    # テーマ切替ボタンの確認
    expect(page).to have_css("#theme-toggle")

    # アイコンの確認 (svgタグの存在確認)
    expect(page).to have_css("svg")
  end
end
