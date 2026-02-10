/**
 * テーマ切り替え機能
 * theme/index.js
 */
export class ThemeComponent {
  constructor() {
    this.toggleButton = document.getElementById("theme-toggle")
    
    if (this.toggleButton) {
      this.toggleButton.addEventListener("click", () => this.toggle())
    }
  }

  toggle() {
    const isDark = document.documentElement.classList.toggle("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }
}
