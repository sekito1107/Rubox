import { Controller } from "@hotwired/stimulus"

const EXAMPLES = {
  hello: `# Hello World
puts "Hello, RubPad!"
puts "Ruby Version: #{RUBY_VERSION}"
`,
  fizzbuzz: `# FizzBuzz
(1..20).each do |i|
  if i % 15 == 0
    puts "FizzBuzz"
  elsif i % 3 == 0
    puts "Fizz"
  elsif i % 5 == 0
    puts "Buzz"
  else
    puts i
  end
end
`,
  fibonacci: `# Fibonacci Sequence
def fib(n)
  return n if n <= 1
  fib(n - 1) + fib(n - 2)
end

puts "fib(10) = #{fib(10)}"
`,
  primes: `# Prime Numbers
require 'prime'

puts "Primes up to 100:"
puts Prime.each(100).to_a.join(", ")
`
}

export default class extends Controller {
  static targets = ["menu"]

  connect() {
    this.editor = null
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
    
    // ウィンドウクリックで閉じる処理
    this.boundClose = this.close.bind(this)
    window.addEventListener("click", this.boundClose)
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
    window.removeEventListener("click", this.boundClose)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
  }

  toggle(event) {
    event.stopPropagation()
    this.menuTarget.classList.toggle("hidden")
  }

  close(event) {
    // メニューが開いていて、かつクリックされた場所がコントローラー要素の外部なら閉じる
    if (!this.menuTarget.classList.contains("hidden") && !this.element.contains(event.target)) {
      this.menuTarget.classList.add("hidden")
    }
  }

  load(event) {
    event.preventDefault()
    if (!this.editor) return

    if (!confirm("現在のコードは失われます。サンプルコードを読み込みますか？")) {
      return
    }

    const key = event.currentTarget.dataset.key
    const code = EXAMPLES[key]
    if (code) {
      this.editor.setValue(code)
      this.menuTarget.classList.add("hidden")
    }
  }
}
