/**
 * メソッドリストコンポーネント
 */
export class MethodListComponent {
  private listElement: HTMLElement | null
  private loaderElement: HTMLElement | null
  private cardTemplate: HTMLTemplateElement
  private linkTemplate: HTMLTemplateElement
  private searchTemplate: HTMLTemplateElement

  private cardMap: Map<string, HTMLElement>
  private boundHandleAnalysisUpdated: (e: any) => void
  private boundInitData: () => void

  constructor(
    listElement: HTMLElement | null,
    loaderElement: HTMLElement | null,
    cardTemplate: HTMLTemplateElement,
    linkTemplate: HTMLTemplateElement,
    searchTemplate: HTMLTemplateElement
  ) {
    this.listElement = listElement
    this.loaderElement = loaderElement
    this.cardTemplate = cardTemplate
    this.linkTemplate = linkTemplate
    this.searchTemplate = searchTemplate
    
    this.cardMap = new Map()

    this.boundHandleAnalysisUpdated = (e: any) => {
      this.renderMethodList(e.detail.methods, e.detail.firstScanDone)
    }
    this.boundInitData = () => {
      const g = window as any
      if (g.rubbitAnalysisCoordinator) {
        const { methods, firstScanDone } = g.rubbitAnalysisCoordinator.getAnalysis()
        this.renderMethodList(methods, firstScanDone)
      }
    }

    window.addEventListener("rubbit:analysis-updated", this.boundHandleAnalysisUpdated)
    window.addEventListener("rubbit:lsp-ready", this.boundInitData)

    this.boundInitData()
  }

  private renderMethodList(methods: any[], firstScanDone: boolean): void {
    if (!this.listElement) return

    if (!firstScanDone && methods.length === 0) return

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
      for (const card of this.cardMap.values()) card.remove()
      this.cardMap.clear()
      return
    }

    const bestItems = new Map<string, any>()
    
    // 同名のメソッドが複数ある場合、最も有益な状態（Resolved > Explicit > Bare）を優先する
    methods.forEach(item => {
      const existing = bestItems.get(item.name)
      if (!existing) {
        bestItems.set(item.name, item)
        return
      }
      
      if (this.isBetterItem(item, existing)) {
        bestItems.set(item.name, item)
      }
    })

    const finalMethods = Array.from(bestItems.values())

    // 不要なカードの削除
    const currentNames = new Set(finalMethods.map(m => m.name))
    for (const [name, card] of this.cardMap.entries()) {
      if (!currentNames.has(name)) {
        card.remove()
        this.cardMap.delete(name)
      }
    }

    finalMethods.forEach(item => {
      let card = this.cardMap.get(item.name)

      if (!card) {
        const content = this.cardTemplate.content.cloneNode(true) as DocumentFragment
        card = content.querySelector("div") as HTMLElement
        const nameEl = card.querySelector('[data-role="methodName"]')
        if (nameEl) nameEl.textContent = item.name
        this.cardMap.set(item.name, card)
      }
      
      this.listElement!.appendChild(card)
      this.updateCardStatus(card, item)
    })
  }

  /**
   * どちらのアイテムを表示優先すべきかを判定する
   */
  private isBetterItem(newItem: any, oldItem: any): boolean {
    // 1. Resolved は最強
    if (newItem.status === 'resolved' && oldItem.status !== 'resolved') return true
    if (oldItem.status === 'resolved') return false

    // 2. 進行中 (pending, resolving) は Unknown より強い
    const isNewActive = newItem.status === 'pending' || newItem.status === 'resolving'
    const isOldActive = oldItem.status === 'pending' || oldItem.status === 'resolving'
    if (isNewActive && !isOldActive) return true
    if (isOldActive) return false

    // 3. ScanType が明示的 (dot, call, symbol) なほうを優先 (bare は最弱)
    const isNewExplicit = newItem.scanType && newItem.scanType !== 'bare'
    const isOldExplicit = oldItem.scanType && oldItem.scanType !== 'bare'
    if (isNewExplicit && !isOldExplicit) return true
    
    return false
  }

  private updateCardStatus(card: HTMLElement, item: any): void {
    const detailsContainer = card.querySelector('[data-role="linksDetails"]') as HTMLElement
    const icon = card.querySelector('[data-role="icon"]') as HTMLElement

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
      if (card.getAttribute('data-status') === 'resolved' && 
          card.getAttribute('data-resolved-class') === item.className) return
      
      card.setAttribute('data-status', 'resolved')
      card.setAttribute('data-resolved-class', item.className)
      
      detailsContainer.innerHTML = ""
      icon.textContent = "<>"
      icon.classList.remove("text-slate-400", "dark:text-slate-500")
      icon.classList.add("text-blue-600", "dark:text-blue-400")

      const linkNode = this.linkTemplate.content.cloneNode(true) as DocumentFragment
      const anchor = linkNode.querySelector("a") as HTMLAnchorElement
      anchor.href = item.url
      linkNode.querySelector('[data-role="className"]')!.textContent = item.className
      linkNode.querySelector('[data-role="separatorMethod"]')!.textContent = (item.separator || ".") + item.name
      detailsContainer.appendChild(linkNode)
      return
    }

    if (item.status === 'unknown') {
      // 解決できなかったものでも、明示的にメソッド呼び出しに見えるものは表示する
      // (変数と思われる bare なものだけ除外)
      if (item.scanType === 'bare') {
        card.remove()
        this.cardMap.delete(item.name)
        return
      }

      if (card.getAttribute('data-status') === 'unknown') return
      card.setAttribute('data-status', 'unknown')

      detailsContainer.innerHTML = ""
      icon.textContent = "?"
      icon.classList.remove("text-blue-600", "dark:text-blue-400")
      icon.classList.add("text-slate-400", "dark:text-slate-500")

      const searchNode = this.searchTemplate.content.cloneNode(true) as DocumentFragment
      const anchor = searchNode.querySelector("a") as HTMLAnchorElement
      anchor.href = `https://docs.ruby-lang.org/ja/latest/search/query:${encodeURIComponent(item.name)}`
      searchNode.querySelector("span")!.textContent = "Search in Reference"
      detailsContainer.appendChild(searchNode)
    }
  }

  public dispose(): void {
    window.removeEventListener("rubbit:analysis-updated", this.boundHandleAnalysisUpdated)
    window.removeEventListener("rubbit:lsp-ready", this.boundInitData)
  }
}
