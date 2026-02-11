/**
 * ヘッダーコンポーネント
 * header/index.ts
 */
export class HeaderComponent {
  private versionElement: HTMLElement | null;

  /**
   * @param versionElement - バージョンを表示する要素
   */
  constructor(versionElement: HTMLElement | null) {
    this.versionElement = versionElement;
    
    // RubyVMからのイベントを監視
    window.addEventListener("ruby-vm:ready", (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.version) {
        this.updateVersion(customEvent.detail.version);
      }
    });
  }

  public updateVersion(version: string): void {
    if (this.versionElement) {
      this.versionElement.textContent = version;
    }
  }
}
