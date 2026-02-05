import { Controller } from "@hotwired/stimulus"

// るりまリファレンスのベースURL
const RUREMA_BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
const RUREMA_SEARCH_URL = "https://rurema.clear-code.com/query:"

// メソッド呼び出しを検出する正規表現
// .method_name や .method_name! や .method_name? にマッチ
const METHOD_CALL_REGEX = /\.([a-zA-Z_][a-zA-Z0-9_]*[!?]?)/g

export default class extends Controller {
  static targets = ["content", "cardTemplate", "linkTemplate", "searchTemplate"]

  async connect() {
    this.index = null
    this.editor = null

    // インデックスを読み込む
    await this.loadIndex()

    // エディタの初期化を監視
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(e) {
    this.editor = e.detail.editor
    this.setupContentListener()
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

    // 表示をクリア
    this.contentTarget.innerHTML = ""

    // 各メソッドに対してパネルを生成して追加
    methods.forEach(method => {
      const card = this.createMethodCard(method)
      this.contentTarget.appendChild(card)
    })
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

  createMethodCard(method) {
    // カードテンプレートを複製
    const cardNode = this.cardTemplateTarget.content.cloneNode(true)
    const container = cardNode.querySelector("div") // ルートdiv

    // メソッド名をセット
    cardNode.querySelector('[data-role="methodName"]').textContent = `.${method}`

    const matches = this.index ? this.index[method] : null
    const detailsContainer = cardNode.querySelector('[data-role="linksDetails"]')
    const icon = cardNode.querySelector('[data-role="icon"]')

    if (matches && matches.length > 0) {
      // メソッドが見つかった場合
      // アイコンはそのままでいい (<>)
      
      matches.forEach(match => {
        const linkNode = this.createMatchLink(match)
        detailsContainer.appendChild(linkNode)
      })
    } else {
      // 見つからなかった場合
      // アイコンを ? に変更
      icon.textContent = "?"
      icon.classList.remove("text-blue-600", "dark:text-blue-400")
      icon.classList.add("text-slate-400", "dark:text-slate-500")

      const searchLinkNode = this.createSearchLink(method)
      detailsContainer.appendChild(searchLinkNode)
    }

    return container
  }

  createMatchLink(match) {
    const node = this.linkTemplateTarget.content.cloneNode(true)
    
    // "Array#map" や "Kernel.puts" のような形式をパース
    const isInstanceMethod = match.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const [className, methodName] = match.split(separator)

    // るりまのURLを構築
    const methodType = isInstanceMethod ? "i" : "s"
    const encodedMethod = this.encodeMethodName(methodName)
    const url = `${RUREMA_BASE_URL}/${className}/${methodType}/${encodedMethod}.html`

    // リンク要素の設定
    const anchor = node.querySelector("a")
    anchor.href = url
    
    node.querySelector('[data-role="className"]').textContent = className
    node.querySelector('[data-role="separatorMethod"]').textContent = separator + methodName

    return node
  }

  createSearchLink(method) {
    const node = this.searchTemplateTarget.content.cloneNode(true)
    const anchor = node.querySelector("a")
    
    // るりまサーチのURL
    const searchUrl = `${RUREMA_SEARCH_URL}${encodeURIComponent(method)}/`
    anchor.href = searchUrl

    return node
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
}
