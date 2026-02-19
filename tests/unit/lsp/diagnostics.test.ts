import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleDiagnostics } from '../../../src/lsp/diagnostics';
import * as monaco from 'monaco-editor';

vi.mock('monaco-editor', () => ({
  MarkerSeverity: {
    Error: 8,
    Warning: 4,
    Info: 2,
    Hint: 1
  },
  editor: {
    setModelMarkers: vi.fn()
  }
}));

describe('HandleDiagnostics', () => {
  let mockClient: any;
  let mockEditor: any;
  let mockModel: any;
  let handler: HandleDiagnostics;

  beforeEach(() => {
    mockClient = {
      onNotification: vi.fn()
    };
    mockModel = {};
    mockEditor = {
      getModel: vi.fn().mockReturnValue(mockModel)
    };
    handler = new HandleDiagnostics(mockClient, mockEditor);
    vi.clearAllMocks();
  });

  it('開始時に通知リスナーを登録すること', () => {
    handler.start();
    expect(mockClient.onNotification).toHaveBeenCalledWith('textDocument/publishDiagnostics', expect.any(Function));
    expect(mockClient.onNotification).toHaveBeenCalledWith('rubox/syntaxCheck', expect.any(Function));
  });

  it('publishDiagnostics を受信した際にマーカーを設定すること', () => {
    handler.start();
    const lspHandler = mockClient.onNotification.mock.calls.find((c: any) => c[0] === 'textDocument/publishDiagnostics')[1];
    
    const params = {
      diagnostics: [
        {
          severity: 1, // Error
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Error message'
        }
      ]
    };

    lspHandler(params);

    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(
      mockModel,
      'lsp',
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Error message',
          severity: 8 // monaco.MarkerSeverity.Error
        })
      ])
    );
  });

  it('偽陽性の診断情報をフィルタリングすること', () => {
    handler.start();
    const lspHandler = mockClient.onNotification.mock.calls.find((c: any) => c[0] === 'textDocument/publishDiagnostics')[1];
    
    const params = {
      diagnostics: [
        {
          severity: 1,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          message: 'failed to resolve overload' // フィルタリング対象
        }
      ]
    };

    lspHandler(params);
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(mockModel, 'lsp', []);
  });

  it('構文チェック通知を処理できること', () => {
    handler.start();
    const syntaxHandler = mockClient.onNotification.mock.calls.find((c: any) => c[0] === 'rubox/syntaxCheck')[1];

    syntaxHandler({ valid: true });
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(mockModel, 'ruby-syntax', []);

    syntaxHandler({
      valid: false,
      diagnostics: [{
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
        message: 'Syntax Error'
      }]
    });
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(
      mockModel,
      'ruby-syntax',
      expect.arrayContaining([expect.objectContaining({ message: 'Syntax Error' })])
    );
  });
});
