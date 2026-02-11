/**
 * テーマ切り替え機能
 * theme/index.ts
 */
export class ThemeComponent {
  private toggleButton: HTMLElement | null;

  constructor() {
    this.toggleButton = document.getElementById("theme-toggle");
    
    if (this.toggleButton) {
      this.toggleButton.addEventListener("click", () => this.toggle());
    }
  }

  public toggle(): void {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }
}
