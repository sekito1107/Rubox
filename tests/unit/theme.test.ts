import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeComponent } from '../../src/theme';

describe('ThemeComponent', () => {
  let button: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<button id="theme-toggle"></button>';
    button = document.getElementById('theme-toggle') as HTMLElement;
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('クリック時にダークモードを切り替えること', () => {
    new ThemeComponent();
    
    // 初期状態: ライトモード
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    
    // 1回目クリック: ダークモード ON
    button.click();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    
    // 2回目クリック: ダークモード OFF
    button.click();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('ボタンが存在しない場合でもエラーにならないこと', () => {
    document.body.innerHTML = ''; // ボタンなし
    expect(() => new ThemeComponent()).not.toThrow();
  });
});
