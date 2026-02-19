import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleComponent } from '../../src/console';
import { RubyVM } from '../../src/ruby-vm';
import { EditorComponent } from '../../src/editor';

describe('ConsoleComponent', () => {
  let outputElement: HTMLElement;
  let runButton: HTMLElement;
  let clearButton: HTMLElement;
  let mockRubyVM: any;
  let mockEditor: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="output"></div>
      <button id="run"></button>
      <button id="clear"></button>
      <button id="stdin-toggle"></button>
      <div id="stdin-content"></div>
      <svg id="stdin-arrow"></svg>
      <textarea id="stdin-input"></textarea>
    `;
    outputElement = document.getElementById('output') as HTMLElement;
    runButton = document.getElementById('run') as HTMLElement;
    clearButton = document.getElementById('clear') as HTMLElement;

    // jsdom は scrollIntoView を実装していないためモック化する
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    mockRubyVM = {
      run: vi.fn(),
      onOutput: null,
      onReady: null,
    };

    mockEditor = {
      getValue: vi.fn(),
    };

    new ConsoleComponent(
      outputElement,
      runButton,
      clearButton,
      mockRubyVM as RubyVM,
      mockEditor as EditorComponent
    );
  });

  it('実行ボタンクリック時にコードを実行すること', async () => {
    // コンストラクタでrunButtonがdisabledになっているため解除する
    runButton.removeAttribute('disabled');
    mockEditor.getValue.mockReturnValue('puts "Hello"');
    runButton.click();
    
    expect(mockEditor.getValue).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(mockRubyVM.run).toHaveBeenCalledWith('puts "Hello"', '');
    });
  });

  it('標準入力が指定された場合に RubyVM.run に渡すこと', async () => {
    runButton.removeAttribute('disabled');
    mockEditor.getValue.mockReturnValue('puts gets');
    const stdinInput = document.getElementById('stdin-input') as HTMLTextAreaElement;
    stdinInput.value = 'hello from stdin';
    
    runButton.click();
    
    await vi.waitFor(() => {
      expect(mockRubyVM.run).toHaveBeenCalledWith('puts gets', 'hello from stdin');
    });
  });

  it('クリアボタンクリック時に出力を消去すること', () => {
    outputElement.innerHTML = '<div>Output</div>';
    clearButton.click();
    expect(outputElement.innerHTML).toBe('');
  });

  it('RubyVMからの出力を表示すること', () => {
    // コンストラクタでonOutputが設定されているはず
    expect(mockRubyVM.onOutput).toBeDefined();
    
    const outputText = 'Hello, World!';
    mockRubyVM.onOutput(outputText);
    
    expect(outputElement.textContent).toContain('Hello, World!');
  });
  
  it('エスケープ処理が機能すること', () => {
    const maliciousText = '<script>alert(1)</script>';
    mockRubyVM.onOutput(maliciousText);
    
    expect(outputElement.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(outputElement.querySelector('script')).toBeNull();
  });

  it('RubyVMの準備完了メッセージを表示すること', () => {
    // onFullyReady 内で loading-container が存在すると setTimeout(500ms) で遅延実行される
    vi.useFakeTimers();

    // リファクタリングにより rubox:lsp-ready イベント経由で通知される
    window.dispatchEvent(new CustomEvent('rubox:lsp-ready', {
      detail: { version: '4.0.0' }
    }));
    
    // setTimeout(500ms) を進める
    vi.advanceTimersByTime(500);
    
    expect(outputElement.textContent).toContain('Ruby WASM ready! (Version: 4.0.0)');
    vi.useRealTimers();
  });
  
  it('既存のonOutputコールバックを維持すること', () => {
    const originalCallback = vi.fn();
    mockRubyVM.onOutput = originalCallback; // 再設定する必要があるが、コンストラクタで上書きされる前の状態をシミュレートするのは難しい
    // コンストラクタ呼び出し前に設定しておく必要がある
    
    const localMockVM = {
      run: vi.fn(),
      onOutput: originalCallback, 
      onReady: null
    };
    
    new ConsoleComponent(
      outputElement,
      runButton,
      clearButton,
      localMockVM as any,
      mockEditor as any
    );
    
    localMockVM.onOutput('test');
    expect(originalCallback).toHaveBeenCalledWith('test');
    expect(outputElement.textContent).toContain('test');
  });
});
