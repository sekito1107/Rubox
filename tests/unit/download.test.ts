import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadComponent } from '../../src/download';
import { Exporter } from '../../src/runtime/exporter';

vi.mock('../../src/runtime/exporter', () => {
  const MockExporter = vi.fn(function() {
    return {
      export: vi.fn(),
    };
  });
  return { Exporter: MockExporter };
});

describe('DownloadComponent', () => {
  let button: HTMLElement;
  let mockEditor: any;
  let component: DownloadComponent;

  beforeEach(() => {
    document.body.innerHTML = '<button id="download"></button>';
    button = document.getElementById('download') as HTMLElement;
    mockEditor = { getValue: vi.fn() };
    vi.clearAllMocks();
  });

  it('クリック時にrubbit.rbをエクスポートすること', () => {
    new DownloadComponent(button, mockEditor);
    
    // コンストラクタでExporterがインスタンス化される
    expect(Exporter).toHaveBeenCalledWith(mockEditor);
    const mockExporterInstance = (Exporter as any).mock.results[0].value;

    button.click();

    expect(mockExporterInstance.export).toHaveBeenCalledWith('rubbit.rb');
  });

  it('ボタンが存在しない場合でもエラーにならないこと', () => {
    document.body.innerHTML = ''; // ボタンなし
    expect(() => new DownloadComponent(null, mockEditor)).not.toThrow();
  });
});
