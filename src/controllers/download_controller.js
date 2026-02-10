import { Controller } from "@hotwired/stimulus"
import { Exporter } from "runtime/exporter"

export default class extends Controller {
  connect() {
    this.editor = null
    this.runtime = new Runtime()
    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
    }
    document.addEventListener("editor:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    document.removeEventListener("editor:initialized", this.boundHandleEditorInit)
  }

  download() {
    if (this.runtime && this.editor) {
      this.runtime.export(this.editor.getValue(), "rubpad.rb")
    }
  }
}
