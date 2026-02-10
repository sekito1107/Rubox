import "./main.css"
// Stimulus setup removed


// Features
import { ThemeComponent } from "./theme.js"
import { ShareComponent } from "./share.js"
import { EditorComponent } from "./editor.js"
import { RubyVM } from "./ruby-vm.js"
import { ConsoleComponent } from "./console.js"
import { SettingsComponent } from "./settings.js"
import { DownloadComponent } from "./download.js"
import { HeaderComponent } from "./header.js"
import { ExamplesComponent } from "./examples.js"
import { ToastComponent } from "./toast.js"
import { MethodListComponent, CursorDocComponent } from "./reference.js"

// Persistence
import { Persistence } from "./persistence.js"

document.addEventListener("DOMContentLoaded", () => {
  const persistence = new Persistence()


  // Initialize Features
  new ThemeComponent()
  const editorComponent = new EditorComponent(document.getElementById("editor-container"), persistence)
  console.log("[Main] Created EditorComponent:", editorComponent)
  
  const rubyVM = new RubyVM()
  console.log("[Main] Created RubyVM:", rubyVM)
  
  new ConsoleComponent(
    document.getElementById("terminal-output"),
    document.getElementById("run-button"),
    document.getElementById("clear-button"),
    rubyVM,
    editorComponent
  )

  new SettingsComponent(document.getElementById("settings-modal"), persistence)
  
  new ShareComponent(document.getElementById("share-button"), editorComponent, persistence.share)

  new DownloadComponent(document.getElementById("download-button"), editorComponent)
  
  new HeaderComponent(document.getElementById("ruby-version"))

  new ExamplesComponent(
    document.getElementById("examples-button"),
    document.getElementById("examples-menu"),
    editorComponent
  )
  
  
  new ToastComponent(document.getElementById("toast-container"))

  // Reference Features
  new MethodListComponent(
    document.getElementById("method-list"),
    document.getElementById("method-list-loader"),
    document.getElementById("method-card-template"),
    document.getElementById("link-template"),
    document.getElementById("search-template")
  )

  new CursorDocComponent(
    document.getElementById("cursor-doc-list"),
    document.getElementById("cursor-doc-loader"),
    document.getElementById("cursor-doc-card-template"),
    document.getElementById("cursor-doc-link-template")
  )

  // Note: Stimulus application is still running for other controllers
  // We will migrate them one by one.
})

