/**
 * ダウンロードコンポーネント
 * download/index.js
 */
import { Exporter } from "./runtime/exporter"

export class DownloadComponent {
  /**
   * @param {HTMLElement} buttonElement - ダウンロードボタン
   * @param {EditorComponent} editor - エディタコンポーネント
   */
  constructor(buttonElement, editor) {
    this.button = buttonElement
    this.editor = editor
    this.exporter = new Exporter(this.editor)

    if (this.button) {
      this.button.addEventListener("click", () => this.download())
    }
  }

  download() {
    this.exporter.export("rubpad.rb")
  }
}
