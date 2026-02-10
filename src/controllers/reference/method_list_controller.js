import { Controller } from "@hotwired/stimulus"

/**
 * コード内のメソッド一覧を表示するコントローラー
 * 解析エンジンからの通知を受け取り、DOM を差分更新しつつ順序を同期する
 */
export default class extends Controller {
  static targets = [ "globalList", "globalLoader", "cardTemplate", "linkTemplate", "searchTemplate" ]

  connect() {
    this.cardMap = new Map() // { methodName: DOMElement }

    // 解析状態の更新を監視
    this.boundHandleAnalysisUpdated = (e) => {
      this.renderMethodList(e.detail.methods, e.detail.firstScanDone)
    }
    window.addEventListener("rubpad:analysis-updated", this.boundHandleAnalysisUpdated)

    // 初期データの取得（およびコーディネーターの準備完了待ち）
    this.initData = () => {
      if (window.rubpadAnalysisCoordinator) {
        const { methods, firstScanDone } = window.rubpadAnalysisCoordinator.getAnalysis()
        this.renderMethodList(methods, firstScanDone)
      }
    }

    window.addEventListener("rubpad:lsp-ready", this.initData)
    this.initData()
  }

  disconnect() {
    window.removeEventListener("rubpad:analysis-updated", this.boundHandleAnalysisUpdated)
    window.removeEventListener("rubpad:lsp-ready", this.initData)
  }

  /**
   * メソッドリストをレンダリングする
   */
  renderMethodList(methods, firstScanDone) {
    if (!this.hasGlobalListTarget) return

    // 初期化中（初回スキャン未完了かつメソッドゼロ）なら何もせず、HTMLの初期ローダーを維持する
    if (!firstScanDone && methods.length === 0) return

    // プレースホルダー（"No methods", "Initializing..."）があれば全面クリア
    if (this.hasGlobalLoaderTarget && firstScanDone) {
      this.globalLoaderTarget.classList.add("hidden")
    }

    if (this.globalListTarget.children.length === 1 && 
        (this.globalListTarget.querySelector('.animate-pulse') || 
         this.globalListTarget.innerText.includes('No methods') ||
         this.globalListTarget.querySelector('.loading-bar'))) {
      this.globalListTarget.innerHTML = ""
    }

    if (methods.length === 0) {
      if (this.globalListTarget.innerHTML.trim() === "") {
        this.globalListTarget.innerHTML = `
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
        card = this.cardTemplateTarget.content.cloneNode(true).querySelector("div")
        card.querySelector('[data-role="methodName"]').textContent = item.name
        this.cardMap.set(item.name, card)
      }
      
      // コンテナの末尾に移動（これにより methods 全体の順序が DOM に反映される）
      this.globalListTarget.appendChild(card)

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

      const linkNode = this.linkTemplateTarget.content.cloneNode(true)
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

      const searchNode = this.searchTemplateTarget.content.cloneNode(true)
      searchNode.querySelector("a").href = `https://docs.ruby-lang.org/ja/latest/search/query:${encodeURIComponent(item.name)}`
      searchNode.querySelector("span").textContent = "Search in Reference"
      detailsContainer.appendChild(searchNode)
    }
  }
}
