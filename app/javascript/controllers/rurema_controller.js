import { Controller } from "@hotwired/stimulus"

// るりまリファレンスのベースURL
const RUREMA_BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
const RUREMA_SEARCH_URL = "https://docs.ruby-lang.org/ja/search/"

// メソッド呼び出しを検出する正規表現
// .method_name や .method_name! や .method_name? にマッチ
const METHOD_CALL_REGEX = /\.([a-zA-Z_][a-zA-Z0-9_]*[!?]?)/g

export default class extends Controller {
  static targets = ["content"]

  async connect() {
    this.index = null
    this.editor = null

    // インデックスを読み込む
    await this.loadIndex()

    // エディタの初期化を監視
    document.addEventListener("editor--main:initialized", (e) => {
      this.editor = e.detail.editor
      this.setupContentListener()
    })
  }

  async loadIndex() {
    try {
      const response = await fetch("/data/rurema_index.json")
      this.index = await response.json()
    } catch (error) {
      console.error("るりまインデックスの読み込みに失敗しました:", error)
    }
  }

  setupContentListener() {
    if (!this.editor) return

    // コンテンツの変更を監視
    this.editor.onDidChangeModelContent(() => {
      this.scanAndDisplayMethods()
    })

    // 初回実行
    this.scanAndDisplayMethods()
  }

  scanAndDisplayMethods() {
    if (!this.editor || !this.hasContentTarget) return

    const code = this.editor.getValue()

    // 正規表現でメソッド呼び出しを全て検出
    const methods = this.extractMethods(code)

    if (methods.length === 0) {
      this.contentTarget.innerHTML = `
        <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">
          No methods detected
        </div>
      `
      return
    }

    // 各メソッドに対してパネルを生成
    const html = methods.map(method => this.renderMethodCard(method)).join("")
    this.contentTarget.innerHTML = html
  }

  extractMethods(code) {
    const methods = []
    const seen = new Set()
    let match

    // 正規表現でマッチを順番に取得
    while ((match = METHOD_CALL_REGEX.exec(code)) !== null) {
      const methodName = match[1]

      // 重複を除外（出現順を維持）
      if (!seen.has(methodName)) {
        seen.add(methodName)
        methods.push(methodName)
      }
    }

    return methods
  }

  renderMethodCard(method) {
    if (!this.index) return ""

    const matches = this.index[method]

    if (matches && matches.length > 0) {
      // メソッドが見つかった場合
      return this.renderFoundMethod(method, matches)
    } else {
      // 見つからなかった場合
      return this.renderUnknownMethod(method)
    }
  }

  renderFoundMethod(method, matches) {
    return `
      <div class="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/5 rounded-md overflow-hidden shadow-sm dark:shadow-none">
        <div class="px-3 py-2 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 flex items-center gap-2">
          <span class="text-blue-600 dark:text-blue-400 text-xs font-mono">&lt;&gt;</span>
          <span class="text-slate-800 dark:text-slate-200 text-sm font-semibold font-mono">.${this.escapeHtml(method)}</span>
        </div>
        <div class="p-3 space-y-2">
          ${matches.map(match => this.renderMatchLink(match)).join("")}
        </div>
      </div>
    `
  }

  renderMatchLink(match) {
    // "Array#map" や "Kernel.puts" のような形式をパース
    const isInstanceMethod = match.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const [className, methodName] = match.split(separator)

    // るりまのURLを構築
    const methodType = isInstanceMethod ? "i" : "s"
    const encodedMethod = this.encodeMethodName(methodName)
    const url = `${RUREMA_BASE_URL}/${className}/${methodType}/${encodedMethod}.html`

    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer"
         class="block text-xs text-slate-600 dark:text-slate-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        ${this.escapeHtml(className)}<span class="text-red-500 dark:text-red-400">${separator}${this.escapeHtml(methodName)}</span>
      </a>
    `
  }

  renderUnknownMethod(method) {
    const searchUrl = `${RUREMA_SEARCH_URL}?q=${encodeURIComponent(method)}`

    return `
      <div class="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/5 rounded-md overflow-hidden shadow-sm dark:shadow-none">
        <div class="px-3 py-2 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 flex items-center gap-2">
          <span class="text-slate-400 dark:text-slate-500 text-sm">?</span>
          <span class="text-slate-800 dark:text-slate-200 text-sm font-semibold font-mono">.${this.escapeHtml(method)}</span>
        </div>
        <div class="p-3">
          <a href="${searchUrl}" target="_blank" rel="noopener noreferrer"
             class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            Search in Rurema
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </a>
        </div>
      </div>
    `
  }

  encodeMethodName(name) {
    // メソッド名のURLエンコード（るりま形式）
    return name
      .replace(/\[/g, "=5b")
      .replace(/\]/g, "=5d")
      .replace(/\+/g, "=2b")
      .replace(/\-/g, "=2d")
      .replace(/\*/g, "=2a")
      .replace(/\//g, "=2f")
      .replace(/\%/g, "=25")
      .replace(/\</g, "=3c")
      .replace(/\>/g, "=3e")
      .replace(/\=/g, "=3d")
      .replace(/\!/g, "=21")
      .replace(/\?/g, "=3f")
      .replace(/\~/g, "=7e")
      .replace(/\^/g, "=5e")
      .replace(/\&/g, "=26")
      .replace(/\|/g, "=7c")
      .replace(/\`/g, "=60")
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
