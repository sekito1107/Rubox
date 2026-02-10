import { Executor } from "./runtime/executor"
import { Exporter } from "./runtime/exporter"

/**
 * Runtime ドメインを統括するクラス (Facade)
 */
export class Runtime {
  constructor(vmController) {
    this.executor = new Executor(vmController)
    this.exporter = new Exporter()
  }

  /**
   * コードを実行する
   */
  execute(code) {
    return this.executor.execute(code)
  }

  /**
   * コードをファイルとして書き出す
   */
  export(code, filename) {
    return this.exporter.export(code, filename)
  }
}
