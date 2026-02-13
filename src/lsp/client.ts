/**
 * JSON-RPCを介してRuby Workerと通信するLSPクライアント
 */
export interface LSPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: any;
}

export interface LSPNotification {
  jsonrpc: "2.0";
  method: string;
  params: any;
}

export interface LSPResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: any;
  error?: any;
  method?: string;
  params?: any;
}

export class LSPClient {
  private worker: Worker;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();
  private notificationHandlers: { [method: string]: ((params: any) => void)[] } = {};

  constructor(worker: Worker) {
    this.worker = worker;
    
    // Workerからのメッセージを監視する
    this.worker.addEventListener("message", this.handleMessage.bind(this));
  }

  /**
   * LSPサーバーにリクエストを送り、レスポンスを待機する
   * @param {string} method - LSPメソッド名（例: "initialize"）
   * @param {object} params - リクエストパラメータ
   * @returns {Promise<any>} レスポンス結果
   */
  sendRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      
      // レスポンスが到着したときに呼び出されるPromiseのリゾルバを保存する
      this.pendingRequests.set(id, { resolve, reject });

      console.log(`[LSPClient] Sending Request [${id}]: ${method}`);
      this.worker.postMessage({
        type: "lsp",
        payload: {
          code: JSON.stringify({
            jsonrpc: "2.0",
            id: id,
            method: method,
            params: params
          } as LSPRequest)
        }
      });
    });
  }

  /**
   * 通知を送信する（レスポンスを待機しない）
   * @param {string} method 
   * @param {object} params 
   */
  sendNotification(method: string, params: any = {}): void {
    this.worker.postMessage({
      type: "lsp",
      payload: {
        code: JSON.stringify({
          jsonrpc: "2.0",
          method: method,
          params: params
        } as LSPNotification)
      }
    });
  }

  /**
   * 受信した通知に対するコールバックを登録する
   * @param {string} method - 通知メソッド名
   * @param {Function} callback - コールバック関数 (paramsを受け取る)
   */
  onNotification(method: string | ((params: any) => void), callback?: (params: any) => void): void {
    let actualMethod: string;
    let actualCallback: (params: any) => void;

    if (typeof method === 'function') {
      actualCallback = method;
      actualMethod = '*';
    } else {
      actualMethod = method;
      actualCallback = callback!;
    }
    
    if (!this.notificationHandlers[actualMethod]) {
      this.notificationHandlers[actualMethod] = [];
    }
    this.notificationHandlers[actualMethod].push(actualCallback);
  }

  private handleMessage(event: MessageEvent): void {
    const { type, payload } = event.data;
    if (type !== "lsp") return;
    console.log(`[LSPClient] Message received: ${payload}`);

    try {
      const message = JSON.parse(payload) as LSPResponse; // ペイロードは文字列化されたJSON-RPC
      
      // リクエストへのレスポンス
      if (message.id !== undefined && this.pendingRequests.has(message.id)) {
        const request = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          request.reject(message.error);
        } else {
          request.resolve(message.result);
        }
      } 
      // サーバーからの通知またはリクエスト
      else {
        const method = message.method;
        const params = message.params;
        
        if (method) {
          // 特定のメソッドに対するハンドラを実行
          if (this.notificationHandlers[method]) {
            this.notificationHandlers[method].forEach(handler => handler(params));
          }
          
          // 全通知ハンドラを実行 ('*' キー)
          if (this.notificationHandlers['*']) {
            this.notificationHandlers['*'].forEach(handler => handler(params));
          }
        }
      }
    } catch {
      // failed silently
    }
  }
}
