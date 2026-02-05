import { Controller } from "@hotwired/stimulus"

const EXAMPLES = {
  hello: `# Debug Info
puts "Ruby Version: #{RUBY_VERSION}"
puts "\n$LOAD_PATH:"
puts $LOAD_PATH

puts "\nChecking /usr/local/lib/ruby/3.3.0:"
begin
  entries = Dir.entries("/usr/local/lib/ruby/3.3.0")
  puts "Entries found: #{entries.size}"
  puts entries.first(20).join(", ")
  
  if entries.include?("prime.rb")
    puts "prime.rb exists in directory!"
  else
    puts "prime.rb NOT found in directory."
  end
rescue => e
  puts "Error listing dir: #{e.message}"
end

begin
  require 'prime'
  puts "\nSuccessfully required 'prime'"
rescue LoadError => e
  puts "\nError: #{e.message}"
end
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
