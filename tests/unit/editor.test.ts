import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorComponent } from '../../src/editor';
import { Persistence } from '../../src/persistence';

// モックの定義を vi.hoisted で行うか、vi.mock 内で完結させる
const { mockEditor, mockMonaco } = vi.hoisted(() => {
  const mockEditor = {
    getValue: vi.fn(),
    setValue: vi.fn(),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    addCommand: vi.fn(),
  };

  const mockMonaco = {
    editor: {
      create: vi.fn(() => mockEditor),
      createModel: vi.fn(),
      setTheme: vi.fn(),
    },
    Uri: {
      parse: vi.fn((uri) => ({ toString: () => uri })),
    },
    KeyMod: {
      CtrlCmd: 2048,
    },
    KeyCode: {
      Enter: 3,
    },
  };
  
  return { mockEditor, mockMonaco };
});

vi.mock('monaco-editor', () => ({
  editor: mockMonaco.editor,
  Uri: mockMonaco.Uri,
  KeyMod: mockMonaco.KeyMod,
  KeyCode: mockMonaco.KeyCode,
}));

// Persistenceのモック
// 実際のクラス構造に合わせてモックを作成
vi.mock('../../src/persistence', () => {
  const mockSettings = {
    getAll: vi.fn(() => ({})),
    update: vi.fn(),
  };
  const mockCodePersistence = {
    load: vi.fn(() => null),
    save: vi.fn(),
  };
  return {
    Persistence: vi.fn(function() {
      return {
        settings: mockSettings,
        code: mockCodePersistence,
      };
    }),
  };
});

describe('EditorComponent', () => {
  let container: HTMLElement;
  let persistence: any;
  let component: EditorComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="editor-container"></div>';
    container = document.getElementById('editor-container') as HTMLElement;
    persistence = new Persistence();
    
    // タイマーモック
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (component) {
      component.dispose();
    }
    vi.useRealTimers();
  });

  it('初期化時にエディタを作成し、保存されたコードをロードすること', () => {
    // 依存関係のセットアップ
    persistence.code.load.mockReturnValue('puts "Hello"');
    persistence.settings.getAll.mockReturnValue({ fontSize: "16" });

    component = new EditorComponent(container, persistence);

    expect(mockMonaco.editor.createModel).toHaveBeenCalledWith(
      'puts "Hello"',
      'ruby',
      expect.anything()
    );
    expect(window.monacoEditor).toBe(mockEditor);
  });

  it('テーマ更新が機能すること', () => {
    component = new EditorComponent(container, persistence);

    // Dark mode
    document.documentElement.classList.add('dark');

    expect(mockMonaco.editor.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      theme: 'vs', // 初期は dark クラスなし
    }));
  });

  it('コード変更時に保存されること (Debounce)', () => {
    component = new EditorComponent(container, persistence);
    
    // onDidChangeModelContent のコールバックを取得
    const callback = mockEditor.onDidChangeModelContent.mock.calls[0][0];
    
    // エディタの値を変更したことにする
    mockEditor.getValue.mockReturnValue('new code');
    
    // コールバック実行
    callback();
    
    // まだ保存されていないはず
    expect(persistence.code.save).not.toHaveBeenCalled();
    
    // 時間を進める
    vi.advanceTimersByTime(1000);
    
    expect(persistence.code.save).toHaveBeenCalledWith('new code');
  });

  it('設定更新イベントをハンドリングすること', () => {
    component = new EditorComponent(container, persistence);
    
    const newSettings = {
      fontSize: "20",
      tabSize: "4",
      wordWrap: "on",
      minimap: { enabled: true },
    };
    
    window.dispatchEvent(new CustomEvent('settings:updated', {
      detail: { settings: newSettings }
    }));
    
    expect(mockEditor.updateOptions).toHaveBeenCalledWith(expect.objectContaining({
      fontSize: 20,
      tabSize: 4,
      wordWrap: 'on',
    }));
  });
  
  it('dispose時にリソースを解放すること', () => {
    component = new EditorComponent(container, persistence);
    component.dispose();
    
    expect(mockEditor.dispose).toHaveBeenCalled();
  });
});
