/**
 * ダウンロードコンポーネント
 * download/index.ts
 */
import { Exporter, EditorLike } from "./runtime/exporter";

export class DownloadComponent {
  private button: HTMLElement | null;
  private editor: EditorLike;
  private exporter: Exporter;

  /**
   * @param buttonElement - ダウンロードボタン
   * @param editor - エディタコンポーネント (EditorLike)
   */
  constructor(buttonElement: HTMLElement | null, editor: EditorLike) {
    this.button = buttonElement;
    this.editor = editor;
    this.exporter = new Exporter(this.editor);

    if (this.button) {
      this.button.addEventListener("click", () => this.download());
    }
  }

  public download(): void {
    // "rubpad.rb" seems correct based on JS implementation
    // However, JS code had `this.exporter.export("rubpad.rb")`.
    // The Exporter class has `export(filename: string = "main.rb")`.
    // If I pass "rubpad.rb", it overrides the default.
    this.exporter.export("rubpad.rb");
  }
}
