import { DefaultRubyVM } from "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm"

let vm = null

self.onmessage = async (event) => {
  const { type, payload } = event.data

  switch (type) {
    case "initialize":
      await initializeVM(payload.wasmUrl)
      break
    case "run":
      if (!vm) {
        postMessage({ type: "output", payload: { text: "// Error: Ruby VM is not ready yet." } })
        return
      }
      runCode(payload.code)
      break
    case "lsp":
       if (!vm) return
       // Ruby側の server.add_msg(json_string) メソッドを呼び出す
       // code 引数は LSPClient から渡された JSON 文字列
         // vm.call は存在しないため、グローバル変数を介してデータを渡す
         try {
           self._tmpLspMsg = payload.code
         vm.eval(`$server.add_msg(JS.global[:_tmpLspMsg].to_s)`)
         self._tmpLspMsg = null
       } catch (e) {
         // failed silently
       }
       break
  }
}

async function initializeVM(wasmUrl) {
    try {
      const fullUrl = new URL(wasmUrl, self.location.origin);
      const response = await fetch(fullUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText} (URL: ${fullUrl})`)
    }

    // MIMEタイプのエラー (Incorrect response MIME type) を回避するため、
    // ストリーミングコンパイルではなく ArrayBuffer を介したコンパイルを使用します。
    const buffer = await response.arrayBuffer();
    
    try {
      const module = await WebAssembly.compile(buffer);
      // DefaultRubyVM がスコープ内にあることを確認
      const ruby = { DefaultRubyVM }; 
      const result = await ruby.DefaultRubyVM(module);
      vm = result.vm;

      // RBS標準ライブラリの取得と配置
      try {
        const rbsResponse = await fetch('/rbs/ruby-stdlib.rbs');
        if (rbsResponse.ok) {
          const buffer = await rbsResponse.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const CHUNK_SIZE = 64 * 1024; // 64KB 単位で分割
          
          vm.eval(`Dir.mkdir('/workspace') unless Dir.exist?('/workspace')`);
          
          for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.slice(i, i + CHUNK_SIZE);
            const hexChunk = Array.from(chunk)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            
            const mode = (i === 0) ? 'wb' : 'ab';
            vm.eval(`File.open('/workspace/stdlib.rbs', '${mode}') { |f| f.write(['${hexChunk}'].pack('H*')) }`);
          }
        }
      } catch (e) {
        // failed silently
      }

      // ブートストラップ実行
    } catch (e) {
      throw e;
    }

    // bootstrap.rb (Polyfills & LSP Server) をロードする
    const bootstrapUrl = new URL("./bootstrap.rb", import.meta.url);
    const bootstrapResponse = await fetch(bootstrapUrl)
    const bootstrapCode = await bootstrapResponse.text()

    // VFSに書き込んで読み込む
    // vm.fs (JS API) が利用できない場合があるため、Rubyの標準ライブラリを使用してファイルを作成する
    // ディレクトリを作成
    vm.eval(`Dir.mkdir("/src") unless Dir.exist?("/src")`)
    
    // bootstrap.rb の内容を書き込む (Rubyのインターポレーション #{...} による事故を避けるためBase64経由で渡す)
    const bootstrapB64 = btoa(unescape(encodeURIComponent(bootstrapCode)))
    vm.eval(`File.write("/src/bootstrap.rb", "${bootstrapB64}".unpack1("m"))`)
    
    // LSPからのレスポンスをMain Threadに転送する関数
    self.sendLspResponse = (jsonString) => {
      postMessage({ type: "lsp", payload: jsonString })
    }

    // ブートストラップスクリプトを評価する
    // これにより Server クラスが定義され、インスタンスが作成される
    // インスタンスをグローバル変数 $server にキャプチャする（または最後の式として保持する）
    vm.eval(`
      require "js"
      require_relative "/src/bootstrap"
      $server = Server.new
      # JS側の sendLspResponse 関数を渡す
      # JS.global[:sendLspResponse] は JS::Object (Function) を返す
      $server.start(JS.global[:sendLspResponse]) 
    `)
    
    // vm.call から $server にアクセスできるようにする
    // 単純にトップレベルでメソッドを定義する
    vm.eval(`
      def server
        $server
      end
    `)
    
    postMessage({ type: "output", payload: { text: "// Ruby WASM ready!" } })
    postMessage({ type: "ready", payload: { version: vm.eval("RUBY_VERSION").toString() } })
  } catch (error) {
    postMessage({ type: "error", payload: { message: error.message } })
    postMessage({ type: "output", payload: { text: `// Error: ${error.message}` } })
  }
}

function runCode(code) {
    try {
        // 標準出力をキャプチャするためにコードをラップする
        // $server.run_code を使用して、Measure Value と同じBindingで実行する
        const wrappedCode = `
          require 'stringio'
          $stdout = StringIO.new
          begin
            $server.run_code(${JSON.stringify(code)})
          rescue => e
            puts "Error: #{e.class}: #{e.message}"
            puts e.backtrace.join("\n")
          end
          $stdout.string
        `
        
        const result = vm.eval(wrappedCode)
        postMessage({ type: "output", payload: { text: result.toString() } })
      } catch (error) {
        postMessage({ type: "output", payload: { text: `Error: ${error.toString()}` } })
      }
}
