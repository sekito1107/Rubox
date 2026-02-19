// コード共有機能
// share/index.ts
import { EditorComponent } from "./editor";
import { Share } from "./persistence/share";

export class ShareComponent {
  private button: HTMLElement | null;
  private modal: HTMLDialogElement | null;
  private editor: EditorComponent;
  private service: Share;

  // モーダル内のUI要素
  private tabUrl: HTMLElement | null = null;
  private tabEmbed: HTMLElement | null = null;
  private tabBlock: HTMLElement | null = null;
  private previewArea: HTMLTextAreaElement | null = null;
  private copyButton: HTMLElement | null = null;
  
  // 埋め込みプレビュー
  private embedPreviewContainer: HTMLElement | null = null;
  private embedFrameWrapper: HTMLElement | null = null;

  private currentType: 'url' | 'embed' | 'block' = 'url';

  // buttonElement: Shareボタン
  // modalElement: Shareモーダル
  // editorComponent: エディタコンポーネント (getValue/setValue用)
  // shareService: 共有ロジック (Persistence.share)
  constructor(
    buttonElement: HTMLElement | null,
    modalElement: HTMLElement | null,
    editorComponent: EditorComponent,
    shareService: Share
  ) {
    this.button = buttonElement;
    this.modal = modalElement as HTMLDialogElement;
    this.editor = editorComponent;
    this.service = shareService;

    // モーダルUIの参照
    if (this.modal) {
      this.tabUrl = this.modal.querySelector('#share-tab-url');
      this.tabEmbed = this.modal.querySelector('#share-tab-embed');
      this.tabBlock = this.modal.querySelector('#share-tab-block');
      this.previewArea = this.modal.querySelector('#share-preview');
      this.copyButton = this.modal.querySelector('#share-copy-btn');
      
      this.embedPreviewContainer = this.modal.querySelector('#share-embed-preview-container');
      this.embedFrameWrapper = this.modal.querySelector('#share-embed-frame-wrapper');
    }

    this.bindEvents();

    // 初期化時にURLからコードを復元
    this.restoreFromUrl();
  }

  private bindEvents(): void {
    if (this.button) {
      this.button.addEventListener("click", () => this.openModal());
    }

    if (this.modal) {
      this.tabUrl?.addEventListener('click', () => this.switchTab('url'));
      this.tabEmbed?.addEventListener('click', () => this.switchTab('embed'));
      this.tabBlock?.addEventListener('click', () => this.switchTab('block'));
      
      this.copyButton?.addEventListener('click', () => this.copyToClipboard());
    }
  }

  public openModal(): void {
    if (!this.modal) return;
    
    // デフォルトのタブにリセット
    this.switchTab('url');
    this.modal.showModal();
    this.updatePreview();
  }

  private switchTab(type: 'url' | 'embed' | 'block'): void {
    this.currentType = type;
    this.updateTabStyles();
    this.updatePreview();
  }

  private updateTabStyles(): void {
    const setActive = (el: HTMLElement | null, active: boolean) => {
      if (!el) return;
      if (active) {
        el.classList.add('text-blue-600', 'border-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
        el.classList.remove('text-slate-500', 'border-transparent', 'dark:text-slate-400');
      } else {
        el.classList.remove('text-blue-600', 'border-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
        el.classList.add('text-slate-500', 'border-transparent', 'dark:text-slate-400');
      }
    };

    setActive(this.tabUrl, this.currentType === 'url');
    setActive(this.tabEmbed, this.currentType === 'embed');
    setActive(this.tabBlock, this.currentType === 'block');
  }

  private updatePreview(): void {
    if (!this.previewArea) return;
    
    const code = this.editor.getValue();
    let content = "";
    
    if (this.embedPreviewContainer) {
      this.embedPreviewContainer.classList.add('hidden');
    }
    
    try {
      switch (this.currentType) {
        case 'url': {
          const url = this.service.compress(code);
          window.history.replaceState(null, "", url);
          content = url;
          break;
        }
        case 'embed': {
          content = this.service.generateEmbedTag(code);
          
          if (this.embedPreviewContainer && this.embedFrameWrapper) {
            this.embedPreviewContainer.classList.remove('hidden');
            const srcMatch = content.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) {
              this.embedFrameWrapper.innerHTML = `<iframe src="${srcMatch[1]}" width="100%" height="100%" frameborder="0"></iframe>`;
            }
          }
          break;
        }
        case 'block': {
          content = this.service.generateCodeBlock(code);
          break;
        }
      }
      this.previewArea.value = content;
    } catch {
      // プレビュー生成失敗
      this.previewArea.value = "プレビュー生成エラー";
    }
  }

  public async copyToClipboard(): Promise<void> {
    if (!this.previewArea) return;
    
    try {
      await navigator.clipboard.writeText(this.previewArea.value);
      this.dispatchToast("クリップボードにコピーしました！", "success");
      
      this.modal?.close();
    } catch {
      this.dispatchToast("コピーに失敗しました", "error");
    }
  }

  private restoreFromUrl(): void {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const code = this.service.decompress(hash);
    if (code) {
      this.editor.setValue(code);
      history.replaceState(null, "", window.location.pathname + window.location.search);
      
      // 共有コードが展開されたら警告を表示
      // ユーザーにコード確認を促す (Security)
      this.dispatchToast("⚠️ 共有されたコードです。実行前に内容を確認してください。", "warning");
    }
  }

  private dispatchToast(message: string, type: "success" | "error" | "warning" = "success"): void {
    window.dispatchEvent(new CustomEvent("show-toast", {
      detail: { message, type },
      bubbles: true
    }));
  }
}
