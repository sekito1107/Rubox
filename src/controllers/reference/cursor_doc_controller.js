import { Controller } from "@hotwired/stimulus"

/**
 * カーソル位置のコンテキスト（型）に基づいたドキュメントを表示するコントローラー
 */
export default class extends Controller {
  static targets = [ "contextualList", "contextualLoader", "cardTemplate", "linkTemplate" ]

  connect() {
    this.editor = null
    this.debounceTimer = null
    this.CONTEXT_DEBOUNCE_MS = 300
    this.lastType = null

    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
      this.setupListeners()
    }
    document.addEventListener("editor:initialized", this.boundHandleEditorInit)

    this.boundHandleAnalysisFinished = () => this.updateContextualList()
    window.addEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)

    this.boundHandleLSPReady = () => {
      this.updateContextualList()
    }
    window.addEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)

    if (window.monacoEditor) {
      this.editor = window.monacoEditor
      this.setupListeners()
      this.updateContextualList()
    }
  }

  disconnect() {
    document.removeEventListener("editor:initialized", this.boundHandleEditorInit)
    window.removeEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)
    window.removeEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)
  }

  setupListeners() {
    if (!this.editor) return
    this.editor.onDidChangeCursorPosition(() => this.updateContextualList())
  }

  updateContextualList() {
    if (!this.editor) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      this.toggleContextLoader(true)
      try {
        await this.performContextualUpdate()
      } catch (e) {
        console.error("[CursorDocController] Update failed:", e)
      } finally {
        this.toggleContextLoader(false)
      }
    }, this.CONTEXT_DEBOUNCE_MS)
  }

  async performContextualUpdate() {
    if (!this.hasContextualListTarget || !this.editor) return

    const analysis = window.rubpadAnalysisCoordinator
    if (!analysis) {
        if (!this.contextualListTarget.innerHTML.includes('loading-bar')) {
          this.contextualListTarget.innerHTML = `
            <div class="py-12 px-6">
              <div class="loading-bar-container mb-4">
                <div class="loading-bar"></div>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-600 text-center animate-pulse">Initializing analysis engine...</div>
            </div>
          `
        }
        return
    }

    const position = this.editor.getPosition()
    if (!position) return

    // 1. LSP で型を解決
    const type = await analysis.resolution.resolveAtPosition(position.lineNumber, position.column)

    // type が前回と同じでも、現在ローディングが表示されている場合は強制的に更新する
    const isInitializing = this.contextualListTarget.innerHTML.includes('loading-bar')
    if (type === this.lastType && !isInitializing) return
    this.lastType = type

    this.contextualListTarget.innerHTML = ""

    if (!type || type === "Object") {
      this.contextualListTarget.innerHTML = `
        <div class="text-xs text-slate-400 text-center py-2 italic bg-slate-100/50 dark:bg-white/[0.02] rounded">No context</div>
      `
      return
    }

    // 2. Reference ドメインから情報を取得
    const methods = analysis.reference.fetchMethods(type)

    if (methods.length === 0) {
      this.contextualListTarget.innerHTML = `
        <div class="text-xs text-slate-400 text-center py-2 italic">No methods for ${type}</div>
      `
      return
    }

    this.renderContextualUI(type, methods)
  }

  renderContextualUI(type, methods) {
    const container = document.createElement("details")
    container.className = "group"
    
    const summary = document.createElement("summary")
    summary.className = "flex items-center cursor-pointer p-2 list-none text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded"
    summary.innerHTML = `<span>${type}</span><span class="ml-auto text-[10px] text-slate-400 font-normal">${methods.length} methods</span>`
    container.appendChild(summary)

    const listContainer = document.createElement("div")
    listContainer.className = "pl-2 pt-2 space-y-1"

    methods.forEach(item => {
      const card = this.createContextualMethodCard(item)
      listContainer.appendChild(card)
    })

    container.appendChild(listContainer)
    this.contextualListTarget.appendChild(container)
  }

  toggleContextLoader(show) {
    if (!this.hasContextualLoaderTarget) return
    this.contextualLoaderTarget.style.opacity = show ? "1" : "0"
  }

  createContextualMethodCard(item) {
    const cardNode = this.cardTemplateTarget.content.cloneNode(true)
    const container = cardNode.querySelector("div")
    cardNode.querySelector('[data-role="methodName"]').textContent = `.${item.methodName}`
    const detailsContainer = cardNode.querySelector('[data-role="linksDetails"]')
    item.links.forEach(linkInfo => {
        const linkNode = this.linkTemplateTarget.content.cloneNode(true)
        linkNode.querySelector("a").href = linkInfo.url
        linkNode.querySelector('[data-role="className"]').textContent = linkInfo.className
        linkNode.querySelector('[data-role="separatorMethod"]').textContent = linkInfo.separator + linkInfo.methodName
        detailsContainer.appendChild(linkNode)
    })
    return container
  }
}
