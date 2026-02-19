import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser";
import bootstrapCode from "./ruby/bootstrap.rb?raw";
import envCode from "./ruby/env.rb?raw";
import workspaceCode from "./ruby/workspace.rb?raw";
import measureValueCode from "./ruby/measure_value.rb?raw";
import serverCode from "./ruby/server.rb?raw";

let vm: any = null;
(self as any)._ruboxStdin = "";

// Worker メッセージハンドラ
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case "initialize":
      await initializeVM(payload.wasmUrl);
      break;
    case "run":
      if (!vm) return;
      runCode(payload.code, payload.stdin);
      break;
    case "updateStdin":
      (self as any)._ruboxStdin = payload.stdin;
      break;
    case "lsp":
      if (!vm) return;
      try {
        (self as any)._tmpLspMsg = payload.code;
        vm.eval(`$server.add_msg(JS.global[:_tmpLspMsg].to_s)`);
        (self as any)._tmpLspMsg = null;
      } catch (e: any) {
        postMessage({ type: "output", payload: { text: `// LSP Error: ${e.message}` } });
      }
      break;
  }
};

// Ruby VM の初期化
async function initializeVM(wasmUrl: string) {
  try {
    postMessage({ type: "progress", payload: { percent: 10, message: "Ruby Worker を起動中..." } });

    const fullUrl = new URL(wasmUrl, self.location.origin);
    const rbsUrl = new URL("/rbs/ruby-stdlib.rbs", self.location.origin);

    // 1. リソースの並列取得開始
    const wasmPromise = fetch(fullUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText} (URL: ${fullUrl})`);
      }
      return WebAssembly.compile(await response.arrayBuffer());
    });

    const rbsPromise = fetch(rbsUrl).then(async (response) => {
      if (!response.ok) return null;
      return response.text();
    });

    postMessage({ type: "progress", payload: { percent: 15, message: "リソースを並列ダウンロード中..." } });

    // WASMのコンパイル完了を待機
    const module = await wasmPromise;

    postMessage({ type: "progress", payload: { percent: 30, message: "VM を起動中..." } });
    
    // VMの初期化
    const result = await DefaultRubyVM(module);
    vm = result.vm;

    // bootstrap.rb (ポリフィル & LSP サーバー) をロードする
    
    // 1. VFSのディレクトリ作成
    vm.eval("require 'js'");
    vm.eval("begin; Dir.mkdir('/src'); rescue; end");
    vm.eval("begin; Dir.mkdir('/workspace'); rescue; end");

    // 2. RBS 標準ライブラリのロード (JS Bridge を使用した高速転送)
    postMessage({ type: "progress", payload: { percent: 50, message: "RBS 標準ライブラリを展開中..." } });
    
    const rbsText = await rbsPromise;
    if (rbsText) {
        try {
            // JSメモリ上のデータを直接Rubyから参照して書き込む (Base64オーバーヘッドの回避)
            (self as any)._rbsData = rbsText;
            vm.eval(`File.write("/workspace/stdlib.rbs", JS.global[:_rbsData].to_s)`);
            (self as any)._rbsData = null; // メモリ解放

            postMessage({ type: "progress", payload: { percent: 65, message: "RBS ロード完了、LSP起動準備..." } });
        } catch (e: any) {
            postMessage({ type: "output", payload: { text: `// RBS load failed: ${e.message}` } });
        }
    }

    // 3. スクリプトファイルの書き込み
    const writeRubyFile = (path: string, code: string) => {
      try {
        (self as any)._tmpCode = code;
        vm.eval(`File.write("${path}", JS.global[:_tmpCode].to_s)`);
        (self as any)._tmpCode = null;
      } catch (e: any) {
        postMessage({ type: "output", payload: { text: `// writeRubyFile Failed (${path}): ${e.message}` } });
        throw e;
      }
    };

    writeRubyFile("/src/bootstrap.rb", bootstrapCode);
    writeRubyFile("/src/env.rb", envCode);
    writeRubyFile("/src/workspace.rb", workspaceCode);
    writeRubyFile("/src/measure_value.rb", measureValueCode);
    writeRubyFile("/src/server.rb", serverCode);

    // 4. ブートストラップスクリプトを評価する
    postMessage({ type: "progress", payload: { percent: 70, message: "LSP サーバーを起動中..." } });
    (self as any).sendLspResponse = (jsonString: string) => {
      postMessage({ type: "lsp", payload: jsonString });
    };
    
    // Ruby側から進捗を更新するための関数
    (self as any).updateProgress = (percent: number, message: string) => {
       postMessage({ type: "progress", payload: { percent, message } });
    };

    vm.eval(`
      require "js"
      require_relative "/src/bootstrap"
    `);
    
    vm.eval(`
      def server
        $server
      end
    `);

    postMessage({ type: "ready", payload: { version: vm.eval("RUBY_VERSION").toString() } });
    
  } catch (error: any) {
    postMessage({ type: "error", payload: { message: error.message } });
    postMessage({ type: "output", payload: { text: `// Error: ${error.message}` } });
  }
}

// コードを実行する
function runCode(code: string, stdin?: string) {
  try {
    (self as any)._tmpCode = code;
    (self as any)._ruboxStdin = stdin || "";
    const wrappedCode = `
      require 'stringio'
      $stdout = StringIO.new
      $stdin = StringIO.new(JS.global[:_ruboxStdin].to_s)
      begin
        $server.run_code(JS.global[:_tmpCode].to_s)
      rescue => e
        puts "Error: #{e.class}: #{e.message}"
        puts e.backtrace.join("\\n")
      end
      $stdout.string
    `;
    
    const result = vm.eval(wrappedCode);
    (self as any)._tmpCode = null;
    postMessage({ type: "output", payload: { text: result.toString() } });
  } catch (error: any) {
    (self as any)._tmpCode = null;
    postMessage({ type: "output", payload: { text: `Error: ${error.toString()}` } });
  }
}
