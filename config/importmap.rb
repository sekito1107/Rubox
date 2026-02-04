# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# Ruby WASM for browser-based code execution
pin "@ruby/wasm-wasi", to: "https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.6.0/dist/browser.esm.js"
