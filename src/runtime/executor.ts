// Ruby VM (Worker) へのコード送信と実行結果の購読を担当する
export interface RubyVMController {
  run(code: string, stdin?: string): void;
}

export class Executor {
  private controller: RubyVMController;

  constructor(controller: RubyVMController) {
    this.controller = controller;
  }

  // code: 実行するRubyコード
  // stdin: 標準入力として渡す文字列
  public execute(code: string, stdin?: string): void {
    if (!code) return;
    try {
      this.controller.run(code, stdin);
    } catch (e: any) {
      console.error("Execution failed:", e);
      throw e;
    }
  }
}
