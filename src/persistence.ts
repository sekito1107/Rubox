import { CodePersistence } from "./persistence/code"
import { Settings } from "./persistence/settings"
import { Share } from "./persistence/share"

// Persistence ドメインを統括するクラス (Facade)
export class Persistence {
  public code: CodePersistence
  public settings: Settings
  public share: Share

  constructor() {
    this.code = new CodePersistence()
    this.settings = new Settings()
    this.share = new Share()
  }
}
