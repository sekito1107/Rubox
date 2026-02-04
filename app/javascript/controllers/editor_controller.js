import { Controller } from "@hotwired/stimulus"
import { basicSetup } from "codemirror"
import { EditorView } from "@codemirror/view"
import { ruby } from "@codemirror/lang-ruby"
import { oneDark } from "@codemirror/theme-one-dark"
import { Compartment } from "@codemirror/state"

export default class extends Controller {
  static targets = ["container"]

  connect() {
    this.themeConfig = new Compartment()

    this.editor = new EditorView({
      doc: "# Welcome to RubPad!\n# Type code here and see Rurema links appear on the right.\n\nnames = ['Ruby', 'Python', 'JavaScript']\n\nnames.select { |n| n.include?('u') }\n  .map(&:upcase)\n  .each do |n|\n    puts \"Hello, #{n}!\"\n  end\n\n# Try typing .split or .size below:\n",
      extensions: [
        basicSetup,
        ruby(),
        this.themeConfig.of(this.currentThemeExtension),
        EditorView.lineWrapping
      ],
      parent: this.containerTarget
    })

    // Observe theme changes
    this.observer = new MutationObserver(() => {
      this.updateTheme()
    })
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    })
  }

  disconnect() {
    if (this.editor) {
      this.editor.destroy()
    }
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  updateTheme() {
    this.editor.dispatch({
      effects: this.themeConfig.reconfigure(this.currentThemeExtension)
    })
  }

  get currentThemeExtension() {
    const isDark = document.documentElement.classList.contains("dark")
    return isDark ? oneDark : []
  }
}
