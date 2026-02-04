# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Code Execution", type: :system do
  before do
    driven_by(:selenium_chrome_headless)
  end

  it "executes Ruby code and displays output" do
    visit root_path

    # Wait for Ruby WASM to initialize
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # Clear editor and type code
    # Monaco editor is accessed via its model, which is complex in Capybara.
    # Instead, we'll use JavaScript to set the value directly.
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('puts "Hello from WASM!"');
      }
    JS

    # Click Run button
    click_button "Run"

    # Verify output appears in terminal
    expect(page).to have_content("Hello from WASM!", wait: 10)
  end

  it "handles Ruby errors gracefully" do
    visit root_path

    # Wait for Ruby WASM to initialize
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # Set code with an error
    page.execute_script(<<~JS)
      const editor = window.monaco?.editor?.getEditors()[0];
      if (editor) {
        editor.setValue('undefined_variable');
      }
    JS

    # Click Run button
    click_button "Run"

    # Verify error is displayed
    expect(page).to have_content("Error:", wait: 10)
  end

  it "clears terminal output" do
    visit root_path

    # Wait for Ruby WASM to initialize
    expect(page).to have_content("Ruby WASM ready!", wait: 30)

    # Output something to terminal (init message is already there)
    # Use execute_script to simulate run or just use what's there.
    # The init message "// Ruby WASM ready!" should be present.

    # Click Clear button
    click_button "Clear"

    # Verify terminal is empty (or at least doesn't have the init message)
    expect(page).not_to have_content("Ruby WASM ready!")
    expect(page).not_to have_content("//")
  end
end
