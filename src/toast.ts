/**
 * トーストコンポーネント
 * toast/index.ts
 */
interface ToastEventDetail {
  message: string;
  type?: string;
  duration?: number;
}

export class ToastComponent {
  private container: HTMLElement;
  private messageElement: HTMLElement | null;
  private iconContainer: HTMLElement | null;
  private closeButton: HTMLElement | null;
  private timeout: number | null;
  private boundShow: (event: Event) => void;
  private boundHide: () => void;

  /**
   * @param containerElement - トーストコンテナ
   */
  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this.timeout = null;
    
    // UI参照
    this.messageElement = this.container.querySelector<HTMLElement>('[data-toast="message"]');
    this.iconContainer = this.container.querySelector<HTMLElement>('[data-toast="icon"]');
    this.closeButton = this.container.querySelector<HTMLElement>('[data-toast="close"]');
    
    // メソッドのバインド
    this.boundShow = this.show.bind(this);
    this.boundHide = this.hide.bind(this);

    // グローバルトーストイベントを監視
    window.addEventListener("show-toast", this.boundShow);
    
    // Close button
    if (this.closeButton) {
      this.closeButton.addEventListener("click", this.boundHide);
    }
  }

  // Event type is Generic Event because CustomEvent type param is harder to enforce strictly in DOM listeners
  public show(event: Event): void {
    const customEvent = event as CustomEvent<ToastEventDetail>;
    const { message, type = "success", duration = 3000 } = customEvent.detail;
    
    // メッセージ設定
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
    
    // アイコン切り替え
    this.updateIcon(type);
    
    // 表示アニメーション
    this.container.classList.remove("translate-y-[-100%]", "opacity-0", "pointer-events-none");
    this.container.classList.add("translate-y-0", "opacity-100");

    // 自動非表示タイマー
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (duration > 0) {
      // setTimeout returns number in browser env (which is implied by HTMLElement)
      // but @types/node might make it Timeout. verification needed.
      // Assuming browser context for UI code.
      this.timeout = window.setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  public hide(): void {
    this.container.classList.remove("translate-y-0", "opacity-100");
    this.container.classList.add("translate-y-[-100%]", "opacity-0", "pointer-events-none");
  }

  private updateIcon(type: string): void {
    if (!this.iconContainer) return;
    
    // アイコンの表示/非表示を切り替え
    this.iconContainer.querySelectorAll("svg").forEach((icon: Element) => {
      // dataset is DOMStringMap
      if ((icon as HTMLElement).dataset.type === type) {
        icon.classList.remove("hidden");
      } else {
        icon.classList.add("hidden");
      }
    });
  }
}
