import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LSPClient } from '../../../src/lsp/client';

describe('LSPClient', () => {
  let mockWorker: any;
  let client: LSPClient;

  beforeEach(() => {
    mockWorker = {
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
      removeEventListener: vi.fn()
    };
    client = new LSPClient(mockWorker as Worker);
  });

  describe('sendRequest', () => {
    it('JSON-RPCリクエストをWorkerに送信できること', async () => {
      const requestPromise = client.sendRequest('testMethod', { foo: 'bar' });
      
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'lsp',
        payload: {
          code: expect.stringContaining('"method":"testMethod"')
        }
      });

      // Workerからのレスポンスをシミュレート
      const messageEvent = {
        data: {
          type: 'lsp',
          payload: JSON.stringify({
            jsonrpc: '2.0',
            id: 0,
            result: { success: true }
          })
        }
      };

      // コンストラクタで登録された handleMessage ハンドラを取得して実行
      const handler = mockWorker.addEventListener.mock.calls[0][1];
      handler(messageEvent);

      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });

    it('Workerがエラーを返した際にリジェクトされること', async () => {
      const requestPromise = client.sendRequest('failMethod');
      
      const messageEvent = {
        data: {
          type: 'lsp',
          payload: JSON.stringify({
            jsonrpc: '2.0',
            id: 0,
            error: { code: -32601, message: 'Method not found' }
          })
        }
      };

      const handler = mockWorker.addEventListener.mock.calls[0][1];
      handler(messageEvent);

      await expect(requestPromise).rejects.toEqual({ code: -32601, message: 'Method not found' });
    });
  });

  describe('sendNotification', () => {
    it('JSON-RPC通知を送信できること', () => {
      client.sendNotification('notifyMe', { data: 123 });
      
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'lsp',
        payload: {
          code: expect.stringContaining('"method":"notifyMe"')
        }
      });
    });
  });

  describe('onNotification', () => {
    it('通知ハンドラを登録し、実行できること', () => {
      const handler = vi.fn();
      client.onNotification('myNotify', handler);

      const messageEvent = {
        data: {
          type: 'lsp',
          payload: JSON.stringify({
            jsonrpc: '2.0',
            method: 'myNotify',
            params: { info: 'hello' }
          })
        }
      };

      const messageHandler = mockWorker.addEventListener.mock.calls[0][1];
      messageHandler(messageEvent);

      expect(handler).toHaveBeenCalledWith({ info: 'hello' });
    });

    it('ワイルドカードハンドラをサポートしていること', () => {
      const wildcardHandler = vi.fn();
      client.onNotification(wildcardHandler);

      const messageEvent = {
        data: {
          type: 'lsp',
          payload: JSON.stringify({
            jsonrpc: '2.0',
            method: 'anyMethod',
            params: { ok: true }
          })
        }
      };

      const messageHandler = mockWorker.addEventListener.mock.calls[0][1];
      messageHandler(messageEvent);

      expect(wildcardHandler).toHaveBeenCalledWith({ ok: true });
    });
  });
});
