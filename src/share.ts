/**
 * コード共有機能
 * share/index.ts
 */
import { EditorComponent } from "./editor";
import { Share } from "./persistence/share";

export class ShareComponent {
  private button: HTMLElement | null;
  private editor: EditorComponent;
  private service: Share;

  /**
   * @param buttonElement - Shareボタン
   * @param editorComponent - エディタコンポーネント (getValue/setValue用)
   * @param shareService - 共有ロジック (Persistence.share)
   */
  constructor(
    buttonElement: HTMLElement | null,
    editorComponent: EditorComponent,
    shareService: Share
  ) {
    this.button = buttonElement;
    this.editor = editorComponent;
    this.service = shareService;

    if (this.button) {
      this.button.addEventListener("click", () => this.share());
    }

    // 初期化時にURLからコードを復元
    this.restoreFromUrl();
  }

  public share(): void {
    const code = this.editor.getValue();
    try {
      const url = this.service.compress(code);
      // テスト用に現在のURLハッシュを更新
      window.location.hash = new URL(url).hash;
      navigator.clipboard.writeText(url);
      
      this.dispatchToast("URL copied to clipboard!", "success");
    } catch (err) {
      console.error(err);
      this.dispatchToast("Failed to share code", "error");
    }
  }

  private restoreFromUrl(): void {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    // URLデコードは Share クラス側で行われるか確認が必要だが、
    // ここでは単に渡すだけ。
    const code = this.service.decompress(hash);
    if (code) {
      this.editor.setValue(code);
      // 一度復元したらハッシュを削除
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  private dispatchToast(message: string, type: "success" | "error" = "success"): void {
    window.dispatchEvent(new CustomEvent("show-toast", {
      detail: { message, type },
      bubbles: true
    }));
  }
}
