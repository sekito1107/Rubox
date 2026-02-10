/**
 * メソッドリストコンポーネント
 * reference/method-list.js
 */
export class MethodListComponent {
  /**
   * @param {HTMLElement} listElement - リスト表示要素
   * @param {HTMLElement} loaderElement - ローダー表示要素
   * @param {HTMLTemplateElement} cardTemplate - カードテンプレート
   * @param {HTMLTemplateElement} linkTemplate - リンクテンプレート
   * @param {HTMLTemplateElement} searchTemplate - 検索リンクテンプレート
   */
  constructor(listElement, loaderElement, cardTemplate, linkTemplate, searchTemplate) {
    this.listElement = listElement
    this.loaderElement = loaderElement
    this.cardTemplate = cardTemplate
    this.linkTemplate = linkTemplate
    this.searchTemplate = searchTemplate
    
    this.cardMap = new Map() // { methodName: DOMElement }

    // Bind
    this.boundHandleAnalysisUpdated = (e) => {
      this.renderMethodList(e.detail.methods, e.detail.firstScanDone)
    }
    this.boundInitData = () => {
      if (window.rubpadAnalysisCoordinator) {
        const { methods, firstScanDone } = window.rubpadAnalysisCoordinator.getAnalysis()
        this.renderMethodList(methods, firstScanDone)
      }
    }

    // Listeners
    window.addEventListener("rubpad:analysis-updated", this.boundHandleAnalysisUpdated)
    window.addEventListener("rubpad:lsp-ready", this.boundInitData)

    // Init
    this.boundInitData()
  }

  renderMethodList(methods, firstScanDone) {
    if (!this.listElement) return

    // 初期化中（初回スキャン未完了かつメソッドゼロ）なら何もせず、HTMLの初期ローダーを維持する
    if (!firstScanDone && methods.length === 0) return

    // プレースホルダー（"No methods", "Initializing..."）があれば全面クリア
    if (this.loaderElement && firstScanDone) {
      this.loaderElement.classList.add("hidden")
    }

    if (this.listElement.children.length === 1 && 
        (this.listElement.querySelector('.animate-pulse') || 
         this.listElement.innerText.includes('No methods') ||
         this.listElement.querySelector('.loading-bar'))) {
      this.listElement.innerHTML = ""
    }

    if (methods.length === 0) {
      if (this.listElement.innerHTML.trim() === "") {
        this.listElement.innerHTML = `
          <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">No methods detected</div>
        `
      }
      // 既存のカードがあれば削除
      for (const card of this.cardMap.values()) card.remove()
      this.cardMap.clear()
      return
    }

    const currentNames = new Set(methods.map(m => m.name))

    // 1. 削除されたメソッドのカードを除去
    for (const [name, card] of this.cardMap.entries()) {
      if (!currentNames.has(name)) {
        card.remove()
        this.cardMap.delete(name)
      }
    }

    // 2. 順序の調整と追加
    // methods 配列の順序に従って appendChild することで順番を入れ替える
    methods.forEach(item => {
      let card = this.cardMap.get(item.name)

      if (!card) {
        // 新規作成
        card = this.cardTemplate.content.cloneNode(true).querySelector("div")
        card.querySelector('[data-role="methodName"]').textContent = item.name
        this.cardMap.set(item.name, card)
      }
      
      // コンテナの末尾に移動（これにより methods 全体の順序が DOM に反映される）
      this.listElement.appendChild(card)

      // ステータスに応じた表示更新
      this.updateCardStatus(card, item)
    })
  }

  updateCardStatus(card, item) {
    const detailsContainer = card.querySelector('[data-role="linksDetails"]')
    const icon = card.querySelector('[data-role="icon"]')

    if (item.status === 'pending') {
      if (card.getAttribute('data-status') === 'pending') return
      card.setAttribute('data-status', 'pending')
      detailsContainer.innerHTML = `
        <div class="flex items-center space-x-1 opacity-40 animate-pulse" data-role="loading-indicator">
          <div class="w-2 h-2 bg-slate-400 rounded-full"></div>
          <span class="text-[9px]">Analyzing...</span>
        </div>
      `
      return
    }

    if (item.status === 'resolved') {
      // 型が変わった場合も更新対象にするため、className もチェック
      if (card.getAttribute('data-status') === 'resolved' && 
          card.getAttribute('data-resolved-class') === item.className) return
      
      card.setAttribute('data-status', 'resolved')
      card.setAttribute('data-resolved-class', item.className)
      
      detailsContainer.innerHTML = ""
      icon.textContent = "<>"
      icon.classList.remove("text-slate-400", "dark:text-slate-500")
      icon.classList.add("text-blue-600", "dark:text-blue-400")

      const linkNode = this.linkTemplate.content.cloneNode(true)
      linkNode.querySelector("a").href = item.url
      linkNode.querySelector('[data-role="className"]').textContent = item.className
      linkNode.querySelector('[data-role="separatorMethod"]').textContent = (item.separator || ".") + item.name
      detailsContainer.appendChild(linkNode)
      return
    }

    if (item.status === 'unknown') {
      if (card.getAttribute('data-status') === 'unknown') return
      card.setAttribute('data-status', 'unknown')

      detailsContainer.innerHTML = ""
      icon.textContent = "?"
      icon.classList.remove("text-blue-600", "dark:text-blue-400")
      icon.classList.add("text-slate-400", "dark:text-slate-500")

      const searchNode = this.searchTemplate.content.cloneNode(true)
      searchNode.querySelector("a").href = `https://docs.ruby-lang.org/ja/latest/search/query:${encodeURIComponent(item.name)}`
      searchNode.querySelector("span").textContent = "Search in Reference"
      detailsContainer.appendChild(searchNode)
    }
  }

  dispose() {
    window.removeEventListener("rubpad:analysis-updated", this.boundHandleAnalysisUpdated)
    window.removeEventListener("rubpad:lsp-ready", this.boundInitData)
  }
}
