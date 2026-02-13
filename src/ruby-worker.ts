import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser";
import bootstrapCode from "./ruby/bootstrap.rb?raw";
import envCode from "./ruby/env.rb?raw";
import workspaceCode from "./ruby/workspace.rb?raw";
import measureValueCode from "./ruby/measure_value.rb?raw";
import serverCode from "./ruby/server.rb?raw";

let vm: any = null;

/**
 * Worker メッセージハンドラ
 */
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case "initialize":
      await initializeVM(payload.wasmUrl);
      break;
    case "run":
      if (!vm) return;
      runCode(payload.code);
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

/**
 * Ruby VM の初期化
 */
async function initializeVM(wasmUrl: string) {
  try {
    postMessage({ type: "progress", payload: { percent: 10, message: "Starting Ruby Worker..." } });

    const fullUrl = new URL(wasmUrl, self.location.origin);
    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText} (URL: ${fullUrl})`);
    }

    const buffer = await response.arrayBuffer();

    postMessage({ type: "progress", payload: { percent: 30, message: "Compiling Ruby WASM..." } });
    const module = await WebAssembly.compile(buffer);
    
    const result = await DefaultRubyVM(module);
    vm = result.vm;

      // RBS標準ライブラリの取得と配置
      try {
        const rbsResponse = await fetch('/rbs/ruby-stdlib.rbs');
        if (rbsResponse.ok) {
          const rbsBuffer = await rbsResponse.arrayBuffer();
          const bytes = new Uint8Array(rbsBuffer);
          const CHUNK_SIZE = 256 * 1024; // 256KB 単位で分割

          vm.eval(`Dir.mkdir('/workspace') unless Dir.exist?('/workspace')`);

          for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.slice(i, i + CHUNK_SIZE);
            // Hex変換の高速化
            let hexChunk = '';
            for (let j = 0; j < chunk.length; j++) {
              hexChunk += chunk[j].toString(16).padStart(2, '0');
            }

            const mode = (i === 0) ? 'wb' : 'ab';
            vm.eval(`File.open('/workspace/stdlib.rbs', '${mode}') { |f| f.write(['${hexChunk}'].pack('H*')) }`);
          }
        }
      } catch {
        // Ignore RBS fetch errors
      }

    // bootstrap.rb (Polyfills & LSP Server) をロードする
    postMessage({ type: "progress", payload: { percent: 50, message: "Loading Bootstrap..." } });
    
    // VFSに書き込んで読み込む
    vm.eval(`Dir.mkdir("/src") unless Dir.exist?("/src")`);
    
    const writeRubyFile = (path: string, code: string) => {
      const b64 = btoa(unescape(encodeURIComponent(code)));
      vm.eval(`File.write("${path}", "${b64}".unpack1("m"))`);
    };

    writeRubyFile("/src/bootstrap.rb", bootstrapCode);
    writeRubyFile("/src/env.rb", envCode);
    writeRubyFile("/src/workspace.rb", workspaceCode);
    writeRubyFile("/src/measure_value.rb", measureValueCode);
    writeRubyFile("/src/server.rb", serverCode);


    // LSPからのレスポンスをMain Threadに転送する関数
    (self as any).sendLspResponse = (jsonString: string) => {
      postMessage({ type: "lsp", payload: jsonString });
    };

    // ブートストラップスクリプトを評価する
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

/**
 * コードを実行する
 */
function runCode(code: string) {
  try {
    (self as any)._tmpCode = code;
    const wrappedCode = `
      require 'stringio'
      $stdout = StringIO.new
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
