import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncDocument } from '../../../src/lsp/sync';

describe('SyncDocument', () => {
  let mockClient: any;
  let mockEditor: any;
  let mockModel: any;
  let sync: SyncDocument;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = {
      sendNotification: vi.fn()
    };
    mockModel = {
      getValue: vi.fn().mockReturnValue('initial content'),
      getVersionId: vi.fn().mockReturnValue(1)
    };
    mockEditor = {
      getModel: vi.fn().mockReturnValue(mockModel),
      onDidChangeModelContent: vi.fn()
    };
    sync = new SyncDocument(mockClient, mockEditor);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('開始時に didOpen を送信すること', () => {
    sync.start();
    expect(mockClient.sendNotification).toHaveBeenCalledWith('textDocument/didOpen', expect.objectContaining({
      textDocument: expect.objectContaining({
        text: 'initial content',
        version: 1
      })
    }));
    expect(mockEditor.onDidChangeModelContent).toHaveBeenCalled();
  });

  it('コンテンツ変更時に didChange 通知をデバウンスすること', () => {
    sync.start();
    const changeHandler = mockEditor.onDidChangeModelContent.mock.calls[0][0];
    
    mockModel.getValue.mockReturnValue('new content');
    mockModel.getVersionId.mockReturnValue(2);
    
    changeHandler();
    expect(mockClient.sendNotification).not.toHaveBeenCalledWith('textDocument/didChange', expect.anything());

    vi.advanceTimersByTime(500);
    expect(mockClient.sendNotification).toHaveBeenCalledWith('textDocument/didChange', expect.objectContaining({
      textDocument: expect.objectContaining({ version: 2 }),
      contentChanges: [{ text: 'new content' }]
    }));
  });

  it('保留中の変更を即座にフラッシュすること', () => {
    sync.start();
    const changeHandler = mockEditor.onDidChangeModelContent.mock.calls[0][0];
    
    mockModel.getValue.mockReturnValue('flushed content');
    changeHandler();
    
    sync.flush();
    expect(mockClient.sendNotification).toHaveBeenCalledWith('textDocument/didChange', expect.anything());
  });

  it('一時的なコンテンツを送信できること', async () => {
    sync.start();
    await sync.sendTemporaryContent('temp');
    expect(mockClient.sendNotification).toHaveBeenCalledWith('textDocument/didChange', expect.objectContaining({
      contentChanges: [{ text: 'temp' }]
    }));
  });
});
