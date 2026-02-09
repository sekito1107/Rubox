import * as monaco from 'monaco-editor'
import { LSPResponseParser } from 'utils/lsp_response_parser'

export class LSPInteractor {
  /**
   * @param {LSPClient} client - LSPクライアントインスタンス
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco Editorインスタンス
   */
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    this.model = editor.getModel()
    this.debounceTimer = null
    this.DEBOUNCE_WAIT = 500
    // Key: lineNumber (1-based), Value: measured string
    this.measuredValues = new Map()
    this.inlayHintsEmitter = new monaco.Emitter()
  }

  /**
   * Interactorを起動し、イベントリスナーとプロバイダを登録する
   */
  activate() {
    this.registerProviders()
    this.startDiagnostics()

    // 初期状態を通知 (didOpen)
    const content = this.model.getValue()
    const version = this.model.getVersionId()

    this.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: "inmemory:///workspace/main.rb",
        languageId: "ruby",
        version: version,
        text: content
      }
    })

    this.syncDocument()

    // Inlay Hintsを強制的に有効化
    this.editor.updateOptions({ inlayHints: { enabled: "on" } })
  }

  /**
   * Monacoの各種プロバイダを登録する
   */
  registerProviders() {
    // Inlay Hints Provider
    monaco.languages.registerInlayHintsProvider("ruby", {
      onDidChangeInlayHints: this.inlayHintsEmitter.event,
      provideInlayHints: (model, range, token) => {
        const hints = []
        for (const [line, value] of this.measuredValues.entries()) {
          const lineNum = Number(line)
          if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) continue
          const maxCol = model.getLineMaxColumn(lineNum)
          hints.push({
            kind: monaco.languages.InlayHintKind.Type,
            position: { lineNumber: lineNum, column: maxCol },
            label: ` # => ${value}`,
            paddingLeft: true
          })
        }
        return { hints: hints, dispose: () => {} }
      }
    })

    // ホバープロバイダ
    monaco.languages.registerHoverProvider("ruby", {
      provideHover: async (model, position) => {
        try {
          const response = await this.client.sendRequest("textDocument/hover", {
            textDocument: { uri: "inmemory:///workspace/main.rb" },
            position: {
              line: position.lineNumber - 1, 
              character: position.column - 1
            }
          })

          if (!response || !response.contents) return null

          let markdownContent = response.contents
          if (typeof markdownContent === "object" && markdownContent.value) {
            markdownContent = markdownContent.value
          }

          const wordInfo = model.getWordAtPosition(position)
          const expression = wordInfo ? wordInfo.word : ""

          let additionalContents = []
          const isMethod = markdownContent.includes('#') || (markdownContent.includes('.') && !markdownContent.includes('..'))
          const isKeyword = [
            "if", "else", "elsif", "end", "def", "class", "module", "do", "begin", "rescue", "ensure",
            "puts", "p", "yield", "require", "require_relative", "include", "extend", "module_function",
            "self", "nil", "true", "false"
          ].includes(expression)
          
          const charBefore = wordInfo && wordInfo.startColumn > 1 ? model.getValueInRange(new monaco.Range(
            position.lineNumber, wordInfo.startColumn - 1,
            position.lineNumber, wordInfo.startColumn
          )) : ""
          const isSymbol = charBefore === ':'

          const lineContent = model.getLineContent(position.lineNumber)
          const textBefore = lineContent.substring(0, position.column - 1)
          const quoteCount = (textBefore.match(/['"]/g) || []).length
          const isInsideString = quoteCount % 2 !== 0 && !markdownContent.includes('#')

          if (expression && !isMethod && !isKeyword && !isSymbol && !isInsideString) {
            const params = { expression: expression, line: position.lineNumber, character: position.column }
            const measureCmd = `command:typeprof.measureValue?${encodeURIComponent(JSON.stringify(params))}`
            additionalContents.push({ value: `[Evaluate: ${expression}](${measureCmd})` })
          }

          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            contents: [
              { value: markdownContent, isTrusted: true },
              ...additionalContents.map(c => ({ value: c.value, isTrusted: true }))
            ]
          }
        } catch (e) {
          return null
        }
      }
    })

    // Measure Value コマンドの登録
    monaco.editor.registerCommand("typeprof.measureValue", (accessor, ...args) => {
      try {
        let params = args[0]
        if (!params) return
        this.client.sendRequest("workspace/executeCommand", { command: "typeprof.measureValue", arguments: [params] }).then(result => {
             const line = params.line
             if (line) {
               this.measuredValues.set(line, result)
               this.inlayHintsEmitter.fire()
               this.editor.updateOptions({ inlayHints: { enabled: "off" } })
               setTimeout(() => this.editor.updateOptions({ inlayHints: { enabled: "on" } }), 50)
             } else {
               alert(`Value: ${result}`)
             }
        })
      } catch (e) {
        // failed silently
      }
    })
  }

  /**
   * 診断通知(diagnostics)の監視を開始する
   */
  startDiagnostics() {
    this.client.onNotification("textDocument/publishDiagnostics", (params) => {
      const markers = params.diagnostics
        .filter(diag => {
          // puts または print に関する overload 解決失敗の誤報をフィルタリング
          // メッセージは "failed to resolve overload" または "failed to resolve overloads" を含む場合がある
          const isFalsePositive = (
            diag.message.toLowerCase().includes("failed to resolve overload") && 
            (diag.message.includes("puts") || diag.message.includes("print"))
          );
          return !isFalsePositive;
        })
        .map(diag => ({
          severity: this.mapSeverity(diag.severity),
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "TypeProf"
        }))
      monaco.editor.setModelMarkers(this.model, "lsp", markers)
    })

    this.client.onNotification("rubpad/syntaxCheck", (params) => {
      if (params.valid) {
        monaco.editor.setModelMarkers(this.model, "ruby-syntax", [])
      } else {
        const markers = params.diagnostics.map(diag => ({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "RubySyntax"
        }))
        monaco.editor.setModelMarkers(this.model, "ruby-syntax", markers)
      }
    })
  }

  /**
   * ドキュメントの同期を開始する
   */
  syncDocument() {
    this.editor.onDidChangeModelContent(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.flushDocumentSync(), this.DEBOUNCE_WAIT)
    })
  }

  /**
   * Pending中のドキュメント変更を即座に送信する
   */
  flushDocumentSync() {
    if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
    }
    const content = this.model.getValue()
    const version = this.model.getVersionId()
    this.measuredValues.clear()
    this.inlayHintsEmitter.fire()

    this.client.sendNotification("textDocument/didChange", {
        textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
        contentChanges: [{ text: content }]
    })
  }

  mapSeverity(lspSeverity) {
    switch (lspSeverity) {
      case 1: return monaco.MarkerSeverity.Error
      case 2: return monaco.MarkerSeverity.Warning
      case 3: return monaco.MarkerSeverity.Info
      case 4: return monaco.MarkerSeverity.Hint
      default: return monaco.MarkerSeverity.Info
    }
  }

  async probeTypeWithTemporaryContent(tempContent, lineNumber, column) {
    if (!this.client) return null
    const version = this.model.getVersionId() + 1
    this.client.sendNotification("textDocument/didChange", {
        textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
        contentChanges: [{ text: tempContent }]
    })
    const type = await this.getTypeAtPosition(lineNumber, column, true)
    this.flushDocumentSync()
    return type
  }

  /**
   * 指定位置の変数の型を取得する
   */
  async getTypeAtPosition(lineNumber, column, skipSync = false) {
    try {
      if (!this.client) return null
      if (!skipSync) this.flushDocumentSync()

      const response = await this.client.sendRequest("textDocument/hover", {
        textDocument: { uri: "inmemory:///workspace/main.rb" },
        position: { line: lineNumber - 1, character: column - 1 }
      })

      if (!response || !response.contents) return null

      let markdownContent = response.contents
      if (typeof markdownContent === "object" && markdownContent.value) {
        markdownContent = markdownContent.value
      }

      // 解析を LSPResponseParser に委譲
      return LSPResponseParser.parseClassNameFromHover(markdownContent)
    } catch (e) {
      return null
    }
  }
}
