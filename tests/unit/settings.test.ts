import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsComponent } from '../../src/settings';
import { Persistence } from '../../src/persistence';

describe('SettingsComponent', () => {
  let container: HTMLElement;
  let mockPersistence: any;
  let component: SettingsComponent;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="settings-container">
        <input data-setting="fontSize" type="number" />
        <input data-setting="tabSize" type="number" />
        <input data-setting="wordWrap" type="checkbox" />
        <input data-setting="autoClosingBrackets" type="checkbox" />
        <input data-setting="minimap" type="checkbox" />
        <input data-setting="mouseWheelZoom" type="checkbox" />
        <input data-setting="renderWhitespace" type="checkbox" />
      </div>
    `;
    container = document.getElementById('settings-container') as HTMLElement;

    mockPersistence = {
      settings: {
        getAll: vi.fn(() => ({})),
        update: vi.fn(),
      }
    };
  });

  it('初期化時に設定をロードしてUIに反映すること', () => {
    mockPersistence.settings.getAll.mockReturnValue({
      fontSize: 20,
      wordWrap: 'on',
      minimap: { enabled: true }
    });

    component = new SettingsComponent(container, mockPersistence as Persistence);

    const fontSizeInput = container.querySelector('[data-setting="fontSize"]') as HTMLInputElement;
    const wordWrapInput = container.querySelector('[data-setting="wordWrap"]') as HTMLInputElement;
    const minimapInput = container.querySelector('[data-setting="minimap"]') as HTMLInputElement;

    expect(fontSizeInput.value).toBe('20');
    expect(wordWrapInput.checked).toBe(true);
    expect(minimapInput.checked).toBe(true);
  });

  it('デフォルト値を正しく適用すること', () => {
    mockPersistence.settings.getAll.mockReturnValue({}); // 設定なし

    component = new SettingsComponent(container, mockPersistence as Persistence);

    const fontSizeInput = container.querySelector('[data-setting="fontSize"]') as HTMLInputElement;
    const tabSizeInput = container.querySelector('[data-setting="tabSize"]') as HTMLInputElement;

    expect(fontSizeInput.value).toBe('14'); // Default
    expect(tabSizeInput.value).toBe('2');   // Default
  });

  it('設定変更時に永続化し、イベントを発火すること', () => {
    component = new SettingsComponent(container, mockPersistence as Persistence);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const fontSizeInput = container.querySelector('[data-setting="fontSize"]') as HTMLInputElement;
    fontSizeInput.value = '24';
    fontSizeInput.dispatchEvent(new Event('change'));

    expect(mockPersistence.settings.update).toHaveBeenCalledWith('fontSize', 24);
    
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'settings:updated',
      detail: expect.objectContaining({
        settings: expect.objectContaining({ fontSize: 24 })
      })
    }));
  });

  it('チェックボックスの設定変更を正しく処理すること', () => {
    component = new SettingsComponent(container, mockPersistence as Persistence);

    const wordWrapInput = container.querySelector('[data-setting="wordWrap"]') as HTMLInputElement;
    wordWrapInput.checked = true;
    wordWrapInput.dispatchEvent(new Event('change'));

    expect(mockPersistence.settings.update).toHaveBeenCalledWith('wordWrap', 'on');
  });
});
