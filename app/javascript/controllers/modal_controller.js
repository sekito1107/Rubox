import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  clickOutside(event) {
    if (event.target === this.element) {
      this.element.close()
    }
  }
}
