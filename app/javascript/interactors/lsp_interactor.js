/**
 * LSP Interactor
 * Monaco Editor と LSP Client の仲介を行うクラス
 */
export class LSPInteractor {
  /**
   * @param {LSPClient} client - LSPクライアントインスタンス
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco Editorインスタンス
   */
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    this.monaco = window.monaco
    this.model = editor.getModel()
    this.debounceTimer = null
    this.DEBOUNCE_WAIT = 500
    // Key: lineNumber (1-based), Value: measured string
    this.measuredValues = new Map()
    this.inlayHintsEmitter = new this.monaco.Emitter()
  }

  /**
   * Interactorを起動し、イベントリスナーとプロバイダを登録する
   */
  activate() {
    this.registerProviders()
    this.startDiagnostics()

    // 初期状態を通知 (didOpen)
    // TypeProfは didOpen されたファイルのみを解析対象とする可能性があるため必須
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
    // Inlay Hints Provider (Measure Value の結果表示用)
    this.monaco.languages.registerInlayHintsProvider("ruby", {
      onDidChangeInlayHints: this.inlayHintsEmitter.event,
      provideInlayHints: (model, range, token) => {
        const hints = []

        // 計測された値をInlay Hintとして表示
        for (const [line, value] of this.measuredValues.entries()) {
          const lineNum = Number(line)

          // 範囲外ならスキップ (range.endLineNumber は inclusive)
          if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) continue

          // 行の末尾に表示
          const maxCol = model.getLineMaxColumn(lineNum)

          hints.push({
            kind: this.monaco.languages.InlayHintKind.Type,
            position: { lineNumber: lineNum, column: maxCol },
            label: ` # => ${value}`,
            paddingLeft: true
          })
        }

        return {
          hints: hints,
          dispose: () => {}
        }
      }
    })

    // ホバープロバイダ (型情報 + Measure Value リンク)
    this.monaco.languages.registerHoverProvider("ruby", {
      provideHover: async (model, position) => {
        try {
          const response = await this.client.sendRequest("textDocument/hover", {
            textDocument: { uri: "inmemory:///workspace/main.rb" },
            position: {
              line: position.lineNumber - 1, // 0-based
              character: position.column - 1
            }
          })

          if (!response || !response.contents) return null

          // TypeProfからのレスポンス(Markdown)を取得
          let markdownContent = response.contents
          if (typeof markdownContent === "object" && markdownContent.value) {
            markdownContent = markdownContent.value
          }

          // カーソル位置の単語（変数名など）を取得
          const wordInfo = model.getWordAtPosition(position)
          const expression = wordInfo ? wordInfo.word : ""

          // Measure Value リンクを追加
          // 単語が取得できた場合のみリンクを生成
          let additionalContents = []
          if (expression) {
            const measureCmd = `command:typeprof.measureValue?${encodeURIComponent(JSON.stringify({
              expression: expression,
              line: position.lineNumber, // 1-based line number
              character: position.column // 1-based column
            }))}`
            additionalContents.push({ value: `[Evaluate: ${expression}](${measureCmd})` })
          }

          return {
            range: new this.monaco.Range(
              position.lineNumber, position.column,
              position.lineNumber, position.column
            ),
            contents: [
              { value: markdownContent, isTrusted: true },
              ...additionalContents.map(c => ({ value: c.value, isTrusted: true }))
            ]
          }
        } catch (e) {
          console.error("[LSP] Hover error:", e)
          return null
        }
      }
    })

    // Measure Value コマンドの登録
    // Markdownリンク "command:typeprof.measureValue?ARGS" から呼び出される
    this.monaco.editor.registerCommand("typeprof.measureValue", (accessor, ...args) => {
      try {
        let params = args[0]
        if (!params) return

        this.client.sendRequest("workspace/executeCommand", {
            command: "typeprof.measureValue",
            arguments: [params]
        }).then(result => {
             const line = params.line
             if (line) {
               this.measuredValues.set(line, result)

               // Inlay Hints を更新
               this.inlayHintsEmitter.fire()

               // イベント発火で更新されない場合のための強制リフレッシュ (Toggle)
               // Monaco EditorはInlay Hintsの更新を即座に反映しない場合があるため、
               // オプションをトグルすることで再描画を強制する
               this.editor.updateOptions({ inlayHints: { enabled: "off" } })
               setTimeout(() => {
                 this.editor.updateOptions({ inlayHints: { enabled: "on" } })
               }, 50)
             } else {
               alert(`Value: ${result}`)
             }
        })

      } catch (e) {
        console.error("[LSP] Measure Value failed:", e)
      }
    })
  }

  /**
   * 診断通知(diagnostics)の監視を開始する
   */
  startDiagnostics() {
    this.client.onNotification("textDocument/publishDiagnostics", (params) => {
      // params: { uri: string, diagnostics: Diagnostic[] }
      const markers = params.diagnostics.map(diag => {
        return {
          severity: this.mapSeverity(diag.severity),
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "TypeProf"
        }
      })

      this.monaco.editor.setModelMarkers(this.model, "lsp", markers)
    })

    // カスタム構文チェック通知の受信
    this.client.onNotification("rubpad/syntaxCheck", (params) => {
      // params: { valid: boolean, diagnostics?: Diagnostic[] }
      if (params.valid) {
        this.monaco.editor.setModelMarkers(this.model, "ruby-syntax", [])
      } else {
        const markers = params.diagnostics.map(diag => {
          return {
            severity: this.monaco.MarkerSeverity.Error,
            startLineNumber: diag.range.start.line + 1,
            startColumn: diag.range.start.character + 1,
            endLineNumber: diag.range.end.line + 1,
            endColumn: diag.range.end.character + 1, // 999 扱いで行末まで
            message: diag.message,
            source: "RubySyntax"
          }
        })
        this.monaco.editor.setModelMarkers(this.model, "ruby-syntax", markers)
      }
    })
  }

  /**
   * ドキュメントの同期を開始する (Debounce付き)
   */
  syncDocument() {
    this.editor.onDidChangeModelContent((event) => {
      // 入力があるたびにタイマーをリセット
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      // 入力が止まってから一定時間後に実行
      this.debounceTimer = setTimeout(() => {
        this.flushDocumentSync()
      }, this.DEBOUNCE_WAIT)
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

    // 内容が変わったら計測値をクリア
    this.measuredValues.clear()
    this.inlayHintsEmitter.fire()

    // textDocument/didChange を送信
    this.client.sendNotification("textDocument/didChange", {
        textDocument: {
        uri: "inmemory:///workspace/main.rb",
        version: version
        },
        contentChanges: [{ text: content }]
    })
  }

  /**
   * LSPのSeverityをMonacoのMarkerSeverityに変換
   */
  mapSeverity(lspSeverity) {
    switch (lspSeverity) {
      case 1: return this.monaco.MarkerSeverity.Error
      case 2: return this.monaco.MarkerSeverity.Warning
      case 3: return this.monaco.MarkerSeverity.Info
      case 4: return this.monaco.MarkerSeverity.Hint
      default: return this.monaco.MarkerSeverity.Info
    }
  }

  /**
   * 一時的なコード修正を行った上で型を取得する
   * (例: 末尾の "." を除去して型を取得し、直後に元に戻す)
   */
  async probeTypeWithTemporaryContent(tempContent, lineNumber, column) {
    if (!this.client) return null

    // 1. 一時的な内容を送信
    const version = this.model.getVersionId() + 1 // 仮のバージョン
    this.client.sendNotification("textDocument/didChange", {
        textDocument: {
            uri: "inmemory:///workspace/main.rb",
            version: version
        },
        contentChanges: [{ text: tempContent }]
    })

    // 2. 型を取得
    const type = await this.getTypeAtPosition(lineNumber, column, true) // true = skip flush

    // 3. 元の内容に戻す (flushDocumentSyncで最新状態を送信)
    this.flushDocumentSync()

    return type
  }

  /**
   * 指定位置の変数の型を取得する
   * @param {number} lineNumber - 1-based
   * @param {number} column - 1-based
   * @param {boolean} skipSync - ドキュメント同期をスキップするか
   * @returns {Promise<string|null>} - クラス名 (例: "String") または null
   */
  async getTypeAtPosition(lineNumber, column, skipSync = false) {
    try {
      if (!this.client) return null

      // 最新のドキュメント状態を反映させる
      if (!skipSync) {
          this.flushDocumentSync()
      }

      // TypeProfにHoverリクエストを送る
      const response = await this.client.sendRequest("textDocument/hover", {
        textDocument: { uri: "inmemory:///workspace/main.rb" },
        position: {
          line: lineNumber - 1, // 0-based
          character: column - 1
        }
      })



      if (!response || !response.contents) return null

      // Markdownコンテンツを解析
      let markdownContent = response.contents
      if (typeof markdownContent === "object" && markdownContent.value) {
        markdownContent = markdownContent.value
      }

      // TypeProfのレスポンス形式:
      // ```ruby
      // ClassName
      // ```
      // または
      // **Type**: `ClassName`

      // 単純な実装: Markdown内のコードブロックやバッククォートから型名を探す
      // 例: `String` -> String

      // TypeProf 0.30.1 の挙動を確認しつつ、汎用的な抽出を行う
      // 現状のTypeProfは以下のような形式を返すことが多い:
      // ```ruby
      // Integer
      // ```

      console.log("[LSP] getTypeAtPosition response:", markdownContent) // Debug

      // TypeProfのレスポンス形式 (Markdownコードブロックの場合と、生のシグネチャ文字列の場合がある)
      // 例: "[Integer, Integer, Integer]#collect : -> ::Array[...] | -> ::Enumerator[...]"

      let typeName = null

      // 1. Markdownコードブロック内のクラス名抽出
      const codeBlockMatch = markdownContent.match(/```ruby\n([A-Z][a-zA-Z0-9_:]*)(?:[#.][^\n]*)?\n```/)
      if (codeBlockMatch) {
         typeName = codeBlockMatch[1]
      } else {
        // 2. 生のシグネチャ文字列からの抽出
        // "ReceiverType#method" または "ReceiverType.method"
        // 複雑な型 (Tupleなど) にも対応: "[Integer, Integer]#map"
        const signatureMatch = markdownContent.match(/^([a-zA-Z0-9_:[\] ,]+)[#.]/)
        if (signatureMatch) {
          typeName = signatureMatch[1]
        } else {
            // 3. メソッド名を含まない単純な型名 (例: "String", "Array[Integer]", "Enumerator[...]")
            //    およびタプル記法 (例: "[Integer, Integer]")
            const typeMatch = markdownContent.match(/^([A-Z][a-zA-Z0-9_:]*(?:\[.*\])?)$/)
            const tupleMatch = markdownContent.match(/^(\[.*\])$/)

            if (typeMatch) {
                typeName = typeMatch[1]
            } else if (tupleMatch) {
                typeName = tupleMatch[1] // "[Integer, Integer]" -> Normailze to Array later
            }
        }
      }

      if (typeName) {
        // 型名の正規化
        typeName = typeName.trim()

        // タプル [Type, Type] は Array とみなす
        if (typeName.startsWith("[")) {
          return "Array"
        }

        // ::で始まる場合は削除 (::Integer -> Integer)
        if (typeName.startsWith("::")) {
          typeName = typeName.substring(2)
        }

        // ジェネリクス的な表記があれば除去 (例: Array[Integer] -> Array)
        // TypeProfがどう返すかはバージョンによるが、念のため
        const genericMatch = typeName.match(/^([a-zA-Z0-9_:]+)\[.*\]$/)
        if (genericMatch) {
            typeName = genericMatch[1]
        }

        return typeName
      }

      return null
    } catch (e) {
      console.error("[LSP] getTypeAtPosition error:", e)
      return null
    }
  }
}
