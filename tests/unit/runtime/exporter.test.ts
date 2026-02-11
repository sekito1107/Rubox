import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Exporter } from '../../../src/runtime/exporter';

describe('Exporter', () => {
  let mockEditor: any;
  let exporter: Exporter;

  beforeEach(() => {
    mockEditor = {
      getValue: vi.fn().mockReturnValue('ruby code')
    };
    exporter = new Exporter(mockEditor);
    
    // グローバルオブジェクトのモック
    vi.stubGlobal('Blob', vi.fn());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:url'),
      revokeObjectURL: vi.fn()
    });
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        href: '',
        download: '',
        click: vi.fn()
      })
    });
    // showSaveFilePicker はデフォルトで undefined (非対応ブラウザをシミュレート)
    vi.stubGlobal('window', {
      showSaveFilePicker: undefined
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('export', () => {
    it('showSaveFilePickerが利用できない場合、Blobを作成しダウンロードをトリガーすること', async () => {
      await exporter.export('test.rb');
      
      expect(mockEditor.getValue).toHaveBeenCalled();
      expect(global.Blob).toHaveBeenCalledWith(['ruby code'], { type: 'text/plain' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      
      const mockElement = (document.createElement as any).mock.results[0].value;
      expect(mockElement.download).toBe('test.rb');
      expect(mockElement.href).toBe('blob:url');
      expect(mockElement.click).toHaveBeenCalled();
    });

    it('showSaveFilePickerが利用可能な場合、それを使用して保存すること', async () => {
      const mockWritable = {
        write: vi.fn(),
        close: vi.fn()
      };
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable)
      };
      const mockShowSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);
      vi.stubGlobal('window', { showSaveFilePicker: mockShowSaveFilePicker });

      await exporter.export('test.rb');

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'test.rb',
        types: [{
          description: 'Ruby Source File',
          accept: { 'text/plain': ['.rb'] },
        }],
      });
      expect(mockHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith('ruby code');
      expect(mockWritable.close).toHaveBeenCalled();

      // フォールバックは実行されないこと
      expect(global.Blob).not.toHaveBeenCalled();
    });

    it('showSaveFilePickerでユーザーがキャンセルした場合、何もしないこと', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      const mockShowSaveFilePicker = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('window', { showSaveFilePicker: mockShowSaveFilePicker });

      await exporter.export('test.rb');

      expect(mockShowSaveFilePicker).toHaveBeenCalled();
      // フォールバックは実行されないこと
      expect(global.Blob).not.toHaveBeenCalled();
    });

    it('showSaveFilePickerでその他のエラーが発生した場合、フォールバックすること', async () => {
      const otherError = new Error('Unknown error');
      const mockShowSaveFilePicker = vi.fn().mockRejectedValue(otherError);
      vi.stubGlobal('window', { showSaveFilePicker: mockShowSaveFilePicker });
      
      // console.warn をモックしてノイズを抑制
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await exporter.export('test.rb');

      expect(mockShowSaveFilePicker).toHaveBeenCalled();
      // フォールバックが実行されること
      expect(global.Blob).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('ファイル名が指定されない場合はデフォルトを使用すること', async () => {
      await exporter.export();
      const mockElement = (document.createElement as any).mock.results[0].value;
      expect(mockElement.download).toBe('main.rb');
    });

    it('1秒後にオブジェクトURLを取り消すこと', async () => {
      await exporter.export();
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    });
  });
});
