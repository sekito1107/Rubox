import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExamplesComponent } from '../../src/examples';

describe('ExamplesComponent', () => {
  let button: HTMLElement;
  let menu: HTMLElement;
  let mockEditor: any;
  let component: ExamplesComponent;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="examples-btn"></button>
      <div id="examples-menu" class="hidden">
        <button data-key="hello">Hello</button>
        <button data-key="fizzbuzz">FizzBuzz</button>
      </div>
    `;
    button = document.getElementById('examples-btn') as HTMLElement;
    menu = document.getElementById('examples-menu') as HTMLElement;
    mockEditor = { setValue: vi.fn(), getValue: vi.fn() };
  });

  it('初期化時にイベントリスナーを設定すること', () => {
    // コンストラクタでaddEventListenerが呼ばれるか確認するためにスパイを使う
    const buttonSpy = vi.spyOn(button, 'addEventListener');
    component = new ExamplesComponent(button, menu, mockEditor);
    expect(buttonSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('トグルボタンでメニューの表示/非表示を切り替えること', () => {
    component = new ExamplesComponent(button, menu, mockEditor);
    
    // 開く
    button.click();
    expect(menu.classList.contains('hidden')).toBe(false);
    
    // 閉じる
    button.click();
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('サンプルをクリックするとエディタにコードをロードしメニューを閉じること', () => {
    component = new ExamplesComponent(button, menu, mockEditor);
    menu.classList.remove('hidden'); // 開いた状態にする
    
    const helloBtn = menu.querySelector('button[data-key="hello"]') as HTMLElement;
    helloBtn.click();
    
    expect(mockEditor.setValue).toHaveBeenCalledWith(expect.stringContaining('Hello, RubPad!'));
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('外部クリックでメニューを閉じること', () => {
    component = new ExamplesComponent(button, menu, mockEditor);
    menu.classList.remove('hidden');
    
    document.body.click(); // bodyをクリック（外部）
    
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('メニュー内のクリックでは閉じないこと', () => {
    component = new ExamplesComponent(button, menu, mockEditor);
    menu.classList.remove('hidden');
    
    menu.click(); // メニュー自体をクリック
    
    expect(menu.classList.contains('hidden')).toBe(false);
  });
});
