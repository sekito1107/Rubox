import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShareComponent } from '../../src/share';

describe('ShareComponent', () => {
  let button: HTMLElement;
  let mockEditor: any;
  let mockShare: any;

  const originalLocation = window.location;
  const originalHistory = window.history;


  beforeEach(() => {
    document.body.innerHTML = '<button id="share"></button>';
    button = document.getElementById('share') as HTMLElement;

    mockEditor = {
      getValue: vi.fn(),
      setValue: vi.fn(),
    };

    mockShare = {
      compress: vi.fn(),
      decompress: vi.fn(),
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
    });
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    window.history = originalHistory;
  });

  it('シェアボタンクリック時にURLをクリップボードにコピーすること', () => {
    new ShareComponent(button, mockEditor, mockShare);
    
    const code = 'puts "test"';
    const compressedUrl = 'http://localhost/#compressed';
    
    mockEditor.getValue.mockReturnValue(code);
    mockShare.compress.mockReturnValue(compressedUrl);
    
    button.click();
    
    expect(mockShare.compress).toHaveBeenCalledWith(code);
    expect(window.location.hash).toBe('#compressed');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(compressedUrl);
  });

  it('初期化時にURLハッシュからコードを復元すること', () => {
    window.location.hash = '#compressed_code';
    mockShare.decompress.mockReturnValue('restored code');
    
    new ShareComponent(button, mockEditor, mockShare);
    
    expect(mockShare.decompress).toHaveBeenCalledWith('compressed_code');
    expect(mockEditor.setValue).toHaveBeenCalledWith('restored code');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it('ハッシュがない場合は何もしないこと', () => {
    window.location.hash = '';
    new ShareComponent(button, mockEditor, mockShare);
    expect(mockShare.decompress).not.toHaveBeenCalled();
    expect(mockEditor.setValue).not.toHaveBeenCalled();
  });
  
  it('シェア失敗時にエラーメッセージを表示すること', () => {
    new ShareComponent(button, mockEditor, mockShare);
    
    mockEditor.getValue.mockReturnValue('code');
    mockShare.compress.mockImplementation(() => { throw new Error('Compress error'); });
    
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    
    button.click();
    
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'show-toast',
      detail: expect.objectContaining({ type: 'error' })
    }));
  });
});
