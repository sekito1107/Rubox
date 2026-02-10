/**
 * サンプルコードコンポーネント
 * examples/index.js
 */

const EXAMPLES = {
  hello: `# Hello World
puts "Hello, RubPad!"
puts "Ruby Version: #{RUBY_VERSION}"
`,
  fizzbuzz: `# FizzBuzz
1.upto(100) do |i|
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

export class ExamplesComponent {
  /**
   * @param {HTMLElement} buttonElement - 開閉ボタン
   * @param {HTMLElement} menuElement - メニュー要素
   * @param {EditorComponent} editor - エディタコンポーネント
   */
  constructor(buttonElement, menuElement, editor) {
    this.button = buttonElement
    this.menu = menuElement
    this.editor = editor

    if (this.button && this.menu) {
      this.button.addEventListener("click", (e) => this.toggle(e))
      
      // メニュー内のボタンクリック
      this.menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener("click", (e) => this.load(e))
      })
    }

    // 外部クリックで閉じる
    window.addEventListener("click", (e) => this.close(e))
  }

  toggle(event) {
    event.stopPropagation()
    this.menu.classList.toggle("hidden")
  }

  close(event) {
    if (this.menu && !this.menu.classList.contains("hidden")) {
      // ボタンまたはメニュー自体のクリックでなければ閉じる
      if (!this.button.contains(event.target) && !this.menu.contains(event.target)) {
        this.menu.classList.add("hidden")
      }
    }
  }

  load(event) {
    event.preventDefault()
    if (!this.editor) return

    const btn = event.target.closest('button')
    const key = btn ? btn.dataset.key : null
    const code = EXAMPLES[key]
    if (code) {
      this.editor.setValue(code)
      this.menu.classList.add("hidden")
    }
  }
}
