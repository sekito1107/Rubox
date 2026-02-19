import { Executor, type RubyVMController } from "./runtime/executor";
import { Exporter, type EditorLike } from "./runtime/exporter";

// Runtime ドメインを統括するクラス (Facade)
export class Runtime {
  private executor: Executor;
  private exporter: Exporter;

  constructor(vmController: RubyVMController, editor: EditorLike) {
    this.executor = new Executor(vmController);
    this.exporter = new Exporter(editor);
  }

  // コードを実行する
  execute(code: string): void {
    this.executor.execute(code);
  }

  // コードをファイルとして書き出す
  export(filename?: string): void {
    this.exporter.export(filename);
  }
}
