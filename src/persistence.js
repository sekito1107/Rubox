import { CodePersistence } from "./persistence/code"
import { Settings } from "./persistence/settings"
import { Share } from "./persistence/share"

/**
 * Persistence ドメインを統括するクラス (Facade)
 */
export class Persistence {
  constructor() {
    this.code = new CodePersistence()
    this.settings = new Settings()
    this.share = new Share()
  }

  // 利用側で各インタラクターのメソッドを呼べるようにアクセサを提供
}
