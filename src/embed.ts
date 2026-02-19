import "./main.css"
import * as monaco from "monaco-editor"
import { Share } from "./persistence/share"

// Embed モードでは軽量化のために最小限のセットアップを行う
document.addEventListener("DOMContentLoaded", () => {
  const share = new Share()
  const hash = window.location.hash.substring(1)
  
  // URLハッシュからコードを復元
  const code = share.decompress(hash) || "# Failed to distinct code from URL."
  
  // エディタの初期化
  const editorContainer = document.getElementById("editor-container")!
  
  monaco.editor.create(editorContainer, {
    value: code,
    language: "ruby",
    theme: "vs-dark", // Embedはダークテーマ固定で見やすくする
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
    renderWhitespace: "selection",
    automaticLayout: true,
    padding: { top: 8, bottom: 8 }
  })
  
  // 「Ruboxで開く」リンクの設定
  const openLink = document.getElementById("open-link") as HTMLAnchorElement
  if (openLink) {
    const url = new URL(window.location.href)
    url.pathname = "/" // メインページへ
    openLink.href = url.toString()
  }
})
