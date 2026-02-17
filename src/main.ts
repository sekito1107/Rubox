import "./main.css"

import * as monaco from 'monaco-editor'

// テスト用にグローバル公開
window.monaco = monaco;

// 機能
import { ThemeComponent } from "./theme"
import { ShareComponent } from "./share"
import { EditorComponent } from "./editor"

import { ConsoleComponent } from "./console"
import { SettingsComponent } from "./settings"
import { DownloadComponent } from "./download"
import { HeaderComponent } from "./header"
import { ExamplesComponent } from "./examples"
import { ToastComponent } from "./toast"
import { MethodListComponent, CursorDocComponent } from "./reference"
import { RubyVM } from "./ruby-vm"
import { Persistence } from "./persistence"

document.addEventListener("DOMContentLoaded", () => {
  // 機能の初期化
  new ThemeComponent()

  // RubyVM を早期に初期化 (イベントリスナー登録のため)
  const rubyVM = new RubyVM()

  const persistence = new Persistence()

  const editorComponent = new EditorComponent(document.getElementById("editor-container")!, persistence)
  
  // テスト用にエディタインスタンスを公開 (EditorComponent内部でもやっているが念のため)
  // EditorComponent の public getter を使うか、any キャストで内部 editor にアクセス
  window.monacoEditor = (editorComponent as any).editor;

  new ConsoleComponent(
    document.getElementById("terminal-output")!,
    document.getElementById("run-button")!,
    document.getElementById("clear-button")!,
    rubyVM,
    editorComponent
  )

  new SettingsComponent(document.getElementById("settings-modal")!, persistence)
  
  new ShareComponent(
    document.getElementById("share-button")!, 
    document.getElementById("share-modal")!,
    editorComponent, 
    persistence.share
  )

  new DownloadComponent(document.getElementById("download-button")!, editorComponent)
  
  new HeaderComponent(document.getElementById("ruby-version")!)

  new ExamplesComponent(
    document.getElementById("examples-button")!,
    document.getElementById("examples-menu")!,
    editorComponent
  )
  
  
  new ToastComponent(document.getElementById("toast-container")!)

  // リファレンス機能
  new MethodListComponent(
    document.getElementById("method-list")!,
    document.getElementById("method-list-loader")!,
    document.getElementById("method-card-template")! as HTMLTemplateElement,
    document.getElementById("link-template")! as HTMLTemplateElement,
    document.getElementById("search-template")! as HTMLTemplateElement
  )

  new CursorDocComponent(
    document.getElementById("cursor-doc-list")!,
    document.getElementById("cursor-doc-loader")!,
    document.getElementById("cursor-doc-card-template")! as HTMLTemplateElement,
    document.getElementById("cursor-doc-link-template")! as HTMLTemplateElement
  )

  // BootLoader による初期化シーケンス開始
  import("./boot").then(({ BootLoader }) => {
    // EditorComponent から内部の monaco editor インスタンスを取得
    // (EditorComponent は同期的にインスタンスを生成している前提)
    const monacoEditor = (editorComponent as any).editor;
    const bootLoader = new BootLoader(rubyVM, monacoEditor);
    bootLoader.boot();
  });

})

