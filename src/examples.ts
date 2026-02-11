/**
 * サンプルコードコンポーネント
 * examples/index.ts
 */
import { EditorLike as RuntimeEditorLike } from "./runtime/exporter";

interface EditorLike extends RuntimeEditorLike {
  setValue(value: string): void;
}

const EXAMPLES: Record<string, string> = {
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
};

export class ExamplesComponent {
  private button: HTMLElement | null;
  private menu: HTMLElement | null;
  private editor: EditorLike;

  /**
   * @param buttonElement - 開閉ボタン
   * @param menuElement - メニュー要素
   * @param editor - エディタコンポーネント
   */
  constructor(buttonElement: HTMLElement | null, menuElement: HTMLElement | null, editor: EditorLike) {
    this.button = buttonElement;
    this.menu = menuElement;
    this.editor = editor;

    if (this.button && this.menu) {
      this.button.addEventListener("click", (e) => this.toggle(e));
      
      // メニュー内のボタンクリック
      this.menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener("click", (e) => this.load(e));
      });
    }

    // 外部クリックで閉じる
    window.addEventListener("click", (e) => this.close(e));
  }

  public toggle(event: Event): void {
    event.stopPropagation();
    if (this.menu) {
      this.menu.classList.toggle("hidden");
    }
  }

  public close(event: Event): void {
    if (this.menu && !this.menu.classList.contains("hidden")) {
      // ボタンまたはメニュー自体のクリックでなければ閉じる
      const target = event.target as Node;
      if (this.button && !this.button.contains(target) && !this.menu.contains(target)) {
        this.menu.classList.add("hidden");
      }
    }
  }

  public load(event: Event): void {
    event.preventDefault();
    if (!this.editor) return;

    const target = event.target as HTMLElement;
    const btn = target.closest('button');
    const key = btn ? btn.dataset.key : null;
    
    if (key && EXAMPLES[key]) {
      this.editor.setValue(EXAMPLES[key]);
      if (this.menu) {
        this.menu.classList.add("hidden");
      }
    }
  }
}
