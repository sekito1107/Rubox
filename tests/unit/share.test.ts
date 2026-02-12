import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShareComponent } from '../../src/share';

describe('ShareComponent', () => {
  let button: HTMLElement;
  let modal: HTMLDialogElement; // Modal Mock
  let mockEditor: any;
  let mockShare: any;

  const originalLocation = window.location;
  const originalHistory = window.history;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="share"></button>
      <dialog id="share-modal">
        <button id="share-tab-url"></button>
        <button id="share-tab-embed"></button>
        <button id="share-tab-block"></button>
        
        <div id="share-embed-preview-container" class="hidden">
          <div id="share-embed-frame-wrapper"></div>
        </div>
        
        <textarea id="share-preview"></textarea>
        <button id="share-copy-btn"></button>
      </dialog>
    `;
    button = document.getElementById('share') as HTMLElement;
    modal = document.getElementById('share-modal') as HTMLDialogElement;
    
    // Mock Dialog methods
    modal.showModal = vi.fn();
    modal.close = vi.fn();

    mockEditor = {
      getValue: vi.fn(),
      setValue: vi.fn(),
    };

    mockShare = {
      compress: vi.fn(),
      decompress: vi.fn(),
      generateEmbedTag: vi.fn(),
      generateCodeBlock: vi.fn(),
    };

    // Location Mock
    delete (window as any).location;
    window.location = { ...originalLocation, hash: '', pathname: '/', search: '' } as any;
    
    // History Mock
    delete (window as any).history;
    window.history = { ...originalHistory, replaceState: vi.fn() };

    // Navigator Mock
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      writable: true,
      configurable: true // Allow re-definition
    });
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    window.history = originalHistory;
  });

  it('シェアボタンクリック時にモーダルを開くこと', () => {
    new ShareComponent(button, modal, mockEditor, mockShare);
    
    const code = 'puts "test"';
    const compressedUrl = 'http://localhost/#compressed';
    
    mockEditor.getValue.mockReturnValue(code);
    mockShare.compress.mockReturnValue(compressedUrl);
    
    button.click();
    
    expect(modal.showModal).toHaveBeenCalled();
    // デフォルトでURLプレビューが表示されること
    expect(mockShare.compress).toHaveBeenCalledWith(code);
    expect((modal.querySelector('#share-preview') as HTMLTextAreaElement).value).toBe(compressedUrl);
    // Embedプレビューは非表示であること
    expect((modal.querySelector('#share-embed-preview-container') as HTMLElement).classList.contains('hidden')).toBe(true);
  });

  it('初期化時にURLハッシュからコードを復元すること', () => {
    window.location.hash = '#compressed_code';
    mockShare.decompress.mockReturnValue('restored code');
    
    new ShareComponent(button, modal, mockEditor, mockShare);
    
    expect(mockShare.decompress).toHaveBeenCalledWith('compressed_code');
    expect(mockEditor.setValue).toHaveBeenCalledWith('restored code');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it('タブ切り替えでプレビューが更新されること', () => {
    new ShareComponent(button, modal, mockEditor, mockShare);
    mockEditor.getValue.mockReturnValue('code');
    mockShare.compress.mockReturnValue('url');
    mockShare.generateEmbedTag.mockReturnValue('<iframe src="http://embed"></iframe>');
    mockShare.generateCodeBlock.mockReturnValue('```');

    // Default (URL)
    button.click();
    expect(mockShare.compress).toHaveBeenCalled();
    expect((modal.querySelector('#share-embed-preview-container') as HTMLElement).classList.contains('hidden')).toBe(true);

    // Switch to Embed
    (modal.querySelector('#share-tab-embed') as HTMLElement).click();
    expect(mockShare.generateEmbedTag).toHaveBeenCalledWith('code');
    expect((modal.querySelector('#share-preview') as HTMLTextAreaElement).value).toBe('<iframe src="http://embed"></iframe>');
    
    // Embedプレビューが表示され、iframeが挿入されていること
    const previewContainer = modal.querySelector('#share-embed-preview-container') as HTMLElement;
    const frameWrapper = modal.querySelector('#share-embed-frame-wrapper') as HTMLElement;
    expect(previewContainer.classList.contains('hidden')).toBe(false);
    expect(frameWrapper.innerHTML).toContain('<iframe src="http://embed"');

    // Switch to Code Block
    (modal.querySelector('#share-tab-block') as HTMLElement).click();
    expect(mockShare.generateCodeBlock).toHaveBeenCalledWith('code');
    expect((modal.querySelector('#share-preview') as HTMLTextAreaElement).value).toBe('```');
    // Embedプレビューは非表示に戻ること
    expect(previewContainer.classList.contains('hidden')).toBe(true);
  });
  
  it('コピーボタンでクリップボードにコピーしてモーダルを閉じること', async () => {
    const component = new ShareComponent(button, modal, mockEditor, mockShare);
    
    mockEditor.getValue.mockReturnValue('code');
    mockShare.compress.mockReturnValue('url');
    button.click(); // Open modal to setup preview

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    
    await component.copyToClipboard();
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('url');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'show-toast',
      detail: expect.objectContaining({ type: 'success' })
    }));
    expect(modal.close).toHaveBeenCalled();
  });
});
