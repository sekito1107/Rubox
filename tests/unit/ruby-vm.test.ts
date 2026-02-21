import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RubyVM } from '../../src/ruby-vm';

const mockLSPClient = vi.fn();

// 依存関係をモック化
vi.mock('../../src/lsp/client', () => ({
  LSPClient: vi.fn(function() { return mockLSPClient; }),
}));

vi.mock('../../src/lsp', () => ({
  LSP: vi.fn(),
}));

vi.mock('../../src/reference', () => ({
  Reference: vi.fn(),
}));

vi.mock('../../src/analysis', () => ({
  AnalysisCoordinator: vi.fn(),
}));

describe('RubyVM', () => {
  let vm: RubyVM;
  let mockWorker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    
    // 内部状態をリセット
    (RubyVM as any).isInitializing = false;
    (RubyVM as any).isReady = false;
    Object.defineProperty(window, 'rubyLSP', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(window, 'ruboxLSPManager', { value: undefined, writable: true, configurable: true });

    // テスト毎に新しいWorkerモックを作成
    mockWorker = {
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    
    // Worker のモックを毎回設定
    const MockWorker = vi.fn(function() { return mockWorker; });
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (vm) {
      vm.destroy();
    }
  });

  it('初期化時にWorkerを起動すること', () => {
    vm = new RubyVM();
    expect(window.Worker).toHaveBeenCalledWith(expect.stringContaining('ruby-worker.ts'), expect.anything());
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'initialize',
      payload: { wasmUrl: '/ruby/rubox.wasm' },
    });
  });

  it('Workerからのreadyメッセージを処理すること', async () => {
    vm = new RubyVM();
    const readyEventHandler = vi.fn();
    window.addEventListener('ruby-vm:ready', readyEventHandler);

    expect(mockWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

    const calls = mockWorker.addEventListener.mock.calls.find((call: any[]) => call[0] === 'message');
    const messageHandler = calls[1];

    messageHandler({
      data: {
        type: 'ready',
        payload: { version: '4.0.0' },
      },
    });

    await vm.readyPromise;

    expect((RubyVM as any).isReady).toBe(true);
    expect((RubyVM as any).isInitializing).toBe(false);
    expect(vm.rubyVersion).toBe('4.0.0');
    // イベントは発火されないはず
    expect(readyEventHandler).not.toHaveBeenCalled();

    window.removeEventListener('ruby-vm:ready', readyEventHandler);
  });

  it('Workerからのoutputメッセージを処理すること', () => {
    vm = new RubyVM();
    const onOutput = vi.fn();
    vm.onOutput = onOutput;

    const calls = mockWorker.addEventListener.mock.calls.find((call: any[]) => call[0] === 'message');
    if (!calls) throw new Error('message listener not registered');
    const messageHandler = calls[1];

    messageHandler({
      data: {
        type: 'output',
        payload: { text: 'Hello' },
      },
    });

    expect(onOutput).toHaveBeenCalledWith('Hello');
  });

  it('runメソッドでコードをWorkerに送信すること', () => {
    vm = new RubyVM();
    
    // Worker 初期化を確認
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
       type: 'initialize',
       payload: { wasmUrl: '/ruby/rubox.wasm' },
    });

    // run 呼び出し
    vm.run('puts "Hello"');

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'run',
      payload: { code: 'puts "Hello"', stdin: undefined },
    });
  });

  it('runメソッドでコードと標準入力をWorkerに送信すること', () => {
    vm = new RubyVM();
    vm.run('puts gets', 'hello');
    
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'run',
      payload: { code: 'puts gets', stdin: 'hello' },
    });
  });

  it('Worker未初期化時のrun呼び出しをハンドリングすること', () => {
    // Worker 初期化失敗をシミュレート
    const ErrorWorker = vi.fn(function() {
      throw new Error("Worker Error");
    });
    vi.stubGlobal('Worker', ErrorWorker);
    
    // 状態リセット
    (RubyVM as any).isInitializing = false;
    (RubyVM as any).isReady = false;
    
    const onOutput = vi.fn();
    vm = new RubyVM();
    vm.onOutput = onOutput;
    
    vm.run('test');
    
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('Worker が初期化されていません'));
  });
});
