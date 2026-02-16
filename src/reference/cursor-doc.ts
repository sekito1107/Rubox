/**
 * カーソルドキュメントコンポーネント
 */
export class CursorDocComponent {
  private listElement: HTMLElement | null
  private loaderElement: HTMLElement | null
  private cardTemplate: HTMLTemplateElement
  private linkTemplate: HTMLTemplateElement
  private editor: any | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly CONTEXT_DEBOUNCE_MS = 300
  private lastType: string | null = null

  private boundHandleAnalysisFinished: () => void
  private boundHandleLSPReady: () => void
  private boundHandleEditorInit: (e: any) => void

  constructor(
    listElement: HTMLElement | null,
    loaderElement: HTMLElement | null,
    cardTemplate: HTMLTemplateElement,
    linkTemplate: HTMLTemplateElement
  ) {
    this.listElement = listElement
    this.loaderElement = loaderElement
    this.cardTemplate = cardTemplate
    this.linkTemplate = linkTemplate
    
    this.boundHandleAnalysisFinished = () => this.updateContextualList()
    this.boundHandleLSPReady = () => this.updateContextualList()
    this.boundHandleEditorInit = (e: any) => {
      this.editor = e.detail.editor
      this.setupListeners()
    }

    document.addEventListener("editor:initialized", this.boundHandleEditorInit as any)
    window.addEventListener("rubbit:lsp-analysis-finished", this.boundHandleAnalysisFinished)
    window.addEventListener("rubbit:lsp-ready", this.boundHandleLSPReady)

    const g = window as any
    if (g.monacoEditor) {
      this.editor = g.monacoEditor
      this.setupListeners()
      this.updateContextualList()
    }
  }

  private setupListeners(): void {
    if (!this.editor) return
    this.editor.onDidChangeCursorPosition(() => this.updateContextualList())
  }

  private updateContextualList(): void {
    if (!this.editor) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      this.toggleContextLoader(true)
      try {
        await this.performContextualUpdate()
      } catch (e) {
        console.error("[CursorDocComponent] Update failed:", e)
      } finally {
        this.toggleContextLoader(false)
      }
    }, this.CONTEXT_DEBOUNCE_MS)
  }

  private async performContextualUpdate(): Promise<void> {
    if (!this.listElement || !this.editor) return

    // 新しい位置への移動時に、一旦高さをリセットする
    const parent = this.listElement.parentElement
    if (parent) {
      parent.classList.remove("h-1/2")
      parent.classList.add("h-auto")
    }

    const g = window as any
    const analysis = g.rubbitAnalysisCoordinator
    if (!analysis) {
        if (!this.listElement.innerHTML.includes('loading-bar')) {
          this.listElement.innerHTML = `
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

    const type = await analysis.resolver.resolution.resolveAtPosition(position.lineNumber, position.column)

    const isInitializing = this.listElement.innerHTML.includes('loading-bar')
    if (type === this.lastType && !isInitializing) return
    this.lastType = type

    this.listElement.innerHTML = ""

    if (!type || type === "Object") {
      this.listElement.innerHTML = `
        <div class="text-xs text-slate-400 text-center py-2 italic bg-slate-100/50 dark:bg-white/[0.02] rounded">No context</div>
      `
      return
    }

    const methods = await analysis.reference.fetchMethods(type)

    if (methods.length === 0) {
      this.listElement.innerHTML = `
        <div class="text-xs text-slate-400 text-center py-2 italic">No methods for ${type}</div>
      `
      return
    }

    this.renderContextualUI(type, methods)
  }

  private renderContextualUI(type: string, methods: any[]): void {
    if (!this.listElement) return
    const container = document.createElement("details")
    container.className = "group"
    container.open = false // 初期状態は閉じる
    
    // 展開時の高さ制御用のイベント
    container.addEventListener("toggle", () => {
      const parent = this.listElement?.parentElement
      if (parent) {
        if (container.open) {
          parent.classList.add("h-1/2")
          parent.classList.remove("h-auto")
        } else {
          parent.classList.remove("h-1/2")
          parent.classList.add("h-auto")
        }
      }
    })

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
    this.listElement.appendChild(container)
  }

  private toggleContextLoader(show: boolean): void {
    if (!this.loaderElement) return
    this.loaderElement.style.opacity = show ? "1" : "0"
  }

  private createContextualMethodCard(item: any): HTMLElement {
    const cardNode = this.cardTemplate.content.cloneNode(true) as DocumentFragment
    const container = cardNode.querySelector("div") as HTMLElement
    cardNode.querySelector('[data-role="methodName"]')!.textContent = `.${item.methodName}`
    const detailsContainer = cardNode.querySelector('[data-role="linksDetails"]') as HTMLElement
    item.links.forEach((linkInfo: any) => {
        const linkNode = this.linkTemplate.content.cloneNode(true) as DocumentFragment
        const anchor = linkNode.querySelector("a") as HTMLAnchorElement
        anchor.href = linkInfo.url
        linkNode.querySelector('[data-role="className"]')!.textContent = linkInfo.className
        linkNode.querySelector('[data-role="separatorMethod"]')!.textContent = linkInfo.separator + linkInfo.methodName
        detailsContainer.appendChild(linkNode)
    })
    return container
  }

  public dispose(): void {
    document.removeEventListener("editor:initialized", this.boundHandleEditorInit as any)
    window.removeEventListener("rubbit:lsp-analysis-finished", this.boundHandleAnalysisFinished)
    window.removeEventListener("rubbit:lsp-ready", this.boundHandleLSPReady)
  }
}
