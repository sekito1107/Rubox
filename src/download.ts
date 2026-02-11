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

  public async download(): Promise<void> {
    // "rubbit.rb" seems correct based on JS implementation
    // However, JS code had `this.exporter.export("rubbit.rb")`.
    // The previous implementation used "rubPad" or similar, now standardized to "rubbit.rb"
    // The Exporter class has `export(filename: string = "main.rb")`.
    // If I pass "rubbit.rb", it overrides the default.
    await this.exporter.export("rubbit.rb");
  }
}
