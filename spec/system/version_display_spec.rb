require 'rails_helper'

RSpec.describe 'Version Display', type: :system do
  before do
    driven_by(:selenium_chrome_headless) do |options|
      options.add_argument("--no-sandbox")
      options.add_argument("--disable-dev-shm-usage")
      options.add_argument("--disable-gpu")
      options.add_argument("--window-size=1400,1400")
    end
  end

  it 'displays Ruby version in header' do
    visit root_path
    
    # 初期表示 (Loading state)
    expect(page).to have_content('Running...')
    
    # WASMロード後の表示 (Dynamic update)
    # Ruby 4.0 系を期待しているが、パッケージの実態によるので "Ruby" で始まることを確認
    expect(page).to have_content(/^Ruby \d+\.\d+\.\d+/, wait: 60)
  end
end
