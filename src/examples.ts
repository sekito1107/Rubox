/**
 * サンプルコードコンポーネント
 * examples/index.ts
 */
import { EditorLike as RuntimeEditorLike } from "./runtime/exporter";

interface EditorLike extends RuntimeEditorLike {
  setValue(value: string): void;
}

export const DefaultCode = `# Rubbitへようこそ！
# Rubbitはサーバー通信なしで、即座に Ruby コードの評価と解析を行います。

# 【機能の活用方法】
# 1. 動的リファレンス
#    コード内で使用されているメソッドは、右側のGlobalパネルに自動的に表示されます。
#    また、オブジェクトにカーソルを合わせると、利用可能なメソッド一覧がContextパネルに表示されます。
#    表示されたメソッドをクリックすると、公式リファレンスを直接参照可能です。

# 例: Mathモジュールのメソッド
puts "Square root of 2: #{Math.sqrt(2)}"
puts "Current Time: #{Time.now}"

# 2. 変数の確認
#    変数名にマウスを合わせ、「値を確認」をクリックしてください。
#    実行時の具体的な値が行末に表示されます。

times = [10, 20, 30]

times.each do |n|
  # この \`result\` の上で「値を確認」を試してください
  result = n * 2
  puts "Result: #{result}"
end

# 3. 組み込みメソッドの解析
#    RangeがincludeしているEnumerableモジュールのメソッドなども解析されます。
sum = (1..100).sum
puts "Sum (1..100): #{sum}"
`

const EXAMPLES: Record<string, string> = {
  default: DefaultCode,
  hello: `# Hello World
puts "Hello, Rubbit!"
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
