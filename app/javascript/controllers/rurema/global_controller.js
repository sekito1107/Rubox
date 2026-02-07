import { Controller } from "@hotwired/stimulus"
import { RuremaSearcher } from "utils/rurema_searcher"
import { RuremaUtils } from "utils/rurema_utils"

export default class extends Controller {
  static targets = [ "globalList", "cardTemplate", "linkTemplate", "searchTemplate" ]

  async connect() {
    this.searcher = new RuremaSearcher()
    await this.searcher.loadIndex()

    this.editor = null // Will be set via event

    // エディタの初期化を監視
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)

    // LSPの準備完了を監視
    this.boundHandleLSPReady = this.handleLSPReady.bind(this)
    window.addEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
    window.removeEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)
  }

  handleEditorInit(e) {
    this.editor = e.detail.editor
    this.setupListeners()
  }

  handleLSPReady() {
    this.updateGlobalList()
  }

  setupListeners() {
    if (!this.editor) return

    // ファイル内容の変更 -> Global List 更新
    this.editor.onDidChangeModelContent(() => {
      this.updateGlobalList()
    })

    // 初回実行
    this.updateGlobalList()
  }

  // ==========================================
  // Global List Logic (Regex based + Async Resolve)
  // ==========================================
  updateGlobalList() {
    if (!this.hasGlobalListTarget) return

    const code = this.editor.getValue()
    const foundMethods = this.extractMethodsWithPosition(code)

    if (foundMethods.length === 0) {
      this.globalListTarget.innerHTML = `
        <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">
          No methods detected
        </div>
      `
      return
    }

    this.globalListTarget.innerHTML = ""

    foundMethods.forEach(item => {
      const card = this.createGlobalMethodCard(item)
      this.globalListTarget.appendChild(card)

      this.resolveMethodType(item, card)
    })
  }

  extractMethodsWithPosition(code) {
    const methods = []
    const seen = new Set()
    let match

    const lines = code.split("\n")

    lines.forEach((lineText, lineIndex) => {
      const lineMethodRegex = /(?:\.|&:[ ]*)([a-zA-Z_][a-zA-Z0-9_]*[!?]?)/g
      while ((match = lineMethodRegex.exec(lineText)) !== null) {
        const methodName = match[1]

        // Col calculation: Match start + 1
        const col = match.index + 1

        if (!seen.has(methodName)) {
             seen.add(methodName)
             methods.push({
               name: methodName,
               line: lineIndex + 1,
               col: col,
               fullMatch: match[0]
             })
        }
      }
    })

    return methods
  }

  async resolveMethodType(item, cardElement) {
    if (!window.rubpadLSPInteractor) {
        // Interactor not ready yet
        return
    }

    await new Promise(r => setTimeout(r, 50))

    const offset = item.fullMatch.indexOf(item.name)
    const probeCol = item.col + offset

    const type = await window.rubpadLSPInteractor.getTypeAtPosition(item.line, probeCol)

    if (type) {
      this.updateCardWithContext(cardElement, item.name, type)
    }
  }

  createGlobalMethodCard(item) {
    const cardNode = this.cardTemplateTarget.content.cloneNode(true)
    const container = cardNode.querySelector("div")

    cardNode.querySelector('[data-role="methodName"]').textContent = `.${item.name}`
    const detailsContainer = cardNode.querySelector('[data-role="linksDetails"]')
    const icon = cardNode.querySelector('[data-role="icon"]')

    icon.textContent = "?"
    icon.classList.remove("text-blue-600", "dark:text-blue-400")
    icon.classList.add("text-slate-400", "dark:text-slate-500")

    const searchLinkNode = this.createSearchLink(item.name)
    detailsContainer.appendChild(searchLinkNode)

    return container
  }

  updateCardWithContext(cardElement, methodName, className) {
    const candidates = this.searcher.findMethod(methodName)
    if (!candidates) return

    const match = candidates.find(c => c.startsWith(`${className}#`) || c.startsWith(`${className}.`))

    if (match) {
        const detailsContainer = cardElement.querySelector('[data-role="linksDetails"]')
        const icon = cardElement.querySelector('[data-role="icon"]')

        detailsContainer.innerHTML = ""
        icon.textContent = "<>"
        icon.classList.remove("text-slate-400", "dark:text-slate-500")
        icon.classList.add("text-blue-600", "dark:text-blue-400")

        const linkNode = this.createLinkFromSignature(match)
        detailsContainer.appendChild(linkNode)
    }
  }

  createLinkFromSignature(signature) {
    const node = this.linkTemplateTarget.content.cloneNode(true)
    const info = RuremaUtils.generateUrlInfo(signature)

    const anchor = node.querySelector("a")
    anchor.href = info.url

    node.querySelector('[data-role="className"]').textContent = info.className
    node.querySelector('[data-role="separatorMethod"]').textContent = info.separator + info.methodName

    return node
  }

  createSearchLink(method) {
    const node = this.searchTemplateTarget.content.cloneNode(true)
    const anchor = node.querySelector("a")
    anchor.href = RuremaUtils.generateSearchUrl(method)
    return node
  }
}
