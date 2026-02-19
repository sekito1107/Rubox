// ダウンロードコンポーネント
// download/index.ts
import { Exporter, EditorLike } from "./runtime/exporter";

export class DownloadComponent {
  private button: HTMLElement | null;
  private editor: EditorLike;
  private exporter: Exporter;

  // buttonElement: ダウンロードボタン
  // editor: エディタコンポーネント (EditorLike)
  constructor(buttonElement: HTMLElement | null, editor: EditorLike) {
    this.button = buttonElement;
    this.editor = editor;
    this.exporter = new Exporter(this.editor);

    if (this.button) {
      this.button.addEventListener("click", () => this.download());
    }
  }

  public async download(): Promise<void> {
    await this.exporter.export("rubox.rb");
  }
}
