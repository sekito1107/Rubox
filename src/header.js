/**
 * ヘッダーコンポーネント
 * header/index.js
 */
export class HeaderComponent {
  /**
   * @param {HTMLElement} versionElement - バージョンを表示する要素
   */
  constructor(versionElement) {
    this.versionElement = versionElement
    
    // RubyVMからのイベントを監視 (ruby-vm/index.js が 'ruby-vm:ready' を発火)
    window.addEventListener("ruby-vm:ready", (event) => {
      this.updateVersion(event.detail.version)
    })
  }

  updateVersion(version) {
    if (this.versionElement) {
      this.versionElement.textContent = version
    }
  }
}
