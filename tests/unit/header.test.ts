import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderComponent } from '../../src/header';

describe('HeaderComponent', () => {
  let versionElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<span id="ruby-version"></span>';
    versionElement = document.getElementById('ruby-version') as HTMLElement;
  });

  it('ruby-vm:readyイベントでバージョンを更新すること', () => {
    new HeaderComponent(versionElement);
    
    const event = new CustomEvent('ruby-vm:ready', {
      detail: { version: '3.2.0' }
    });
    window.dispatchEvent(event);
    
    expect(versionElement.textContent).toBe('3.2.0');
  });

  it('要素が存在しない場合でもエラーにならないこと', () => {
    expect(() => new HeaderComponent(null)).not.toThrow();
    
    // イベント発火
    const event = new CustomEvent('ruby-vm:ready', {
      detail: { version: '3.2.0' }
    });
    window.dispatchEvent(event);
  });
});
