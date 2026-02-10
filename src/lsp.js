import { SyncDocument } from "./lsp/sync"
import { HandleDiagnostics } from "./lsp/diagnostics"
import { ProvideHover } from "./lsp/hover"
import { ProvideInlayHints } from "./lsp/inlay_hints"
import { ExecuteCommand } from "./lsp/execute_command"
import { ResolveType } from "./lsp/resolve_type"
import { BootLSP } from "./lsp/boot_lsp"

/**
 * LSP ドメインの機能を統括し、エディタへの接続・同期を管理するクラス
 */
export class LSP {
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    
    // 内部コンポーネントの初期化
    this.boot = new BootLSP(client)
    this.sync = new SyncDocument(client, editor)
    this.diagnostics = new HandleDiagnostics(client, editor)
    this.hover = new ProvideHover(client)
    this.inlayHints = new ProvideInlayHints(editor)
    this.commands = new ExecuteCommand(client, this.inlayHints)
    this.resolver = new ResolveType(client)
  }

  /**
   * LSP サーバ自体の初期化（Handshake）を行う
   */
  async initialize() {
    return this.boot.execute()
  }

  /**
   * エディタ連携機能（同期、診断、プロバイダ）を有効化する
   */
  activate() {
    this.sync.start()
    this.diagnostics.start()
    this.hover.start()
    this.inlayHints.start()
    this.commands.start()
    
    // Inlay Hints を初期状態で有効化
    this.editor.updateOptions({ inlayHints: { enabled: "on" } })
  }

  /**
   * 外部向けの型解決 Facade API
   */
  async getTypeAtPosition(line, col) {
    this.flushDocumentSync()
    return this.resolver.at(line, col)
  }

  /**
   * 一時的なコンテンツで型解決を試みる Facade API
   */
  async probeTypeWithTemporaryContent(content, line, col) {
    return this.resolver.probe(content, line, col, this.sync)
  }

  /**
   * 強制的にドキュメントを同期する
   */
  flushDocumentSync() {
    this.sync.flush()
  }

  /**
   * 測定値をリセットする
   */
  clearMeasuredValues() {
    this.inlayHints.clear()
  }

  /**
   * エディタのモデルを取得 (互換性維持)
   */
  get model() {
    return this.editor.getModel()
  }
}
