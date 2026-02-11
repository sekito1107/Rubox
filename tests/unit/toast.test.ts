import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastComponent } from '../../src/toast';

describe('ToastComponent', () => {
  let container: HTMLElement;
  let messageElement: HTMLElement;
  let closeButton: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="toast" class="translate-y-[-100%] opacity-0 pointer-events-none">
        <div data-toast="message"></div>
        <div data-toast="icon">
          <svg data-type="success" class="hidden"></svg>
          <svg data-type="error" class="hidden"></svg>
        </div>
        <button data-toast="close"></button>
      </div>
    `;
    container = document.getElementById('toast') as HTMLElement;
    messageElement = container.querySelector('[data-toast="message"]') as HTMLElement;
    closeButton = container.querySelector('[data-toast="close"]') as HTMLElement;
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('show-toastイベントで表示され、メッセージとアイコンが更新されること', () => {
    new ToastComponent(container);
    
    const event = new CustomEvent('show-toast', {
      detail: { message: 'Hello', type: 'success' }
    });
    window.dispatchEvent(event);
    
    expect(messageElement.textContent).toBe('Hello');
    expect(container.classList.contains('translate-y-0')).toBe(true);
    expect(container.classList.contains('opacity-100')).toBe(true);
    
    const successIcon = container.querySelector('svg[data-type="success"]');
    expect(successIcon?.classList.contains('hidden')).toBe(false);
  });

  it('指定時間後に自動的に隠れること', () => {
    new ToastComponent(container);
    
    const event = new CustomEvent('show-toast', {
      detail: { message: 'Auto hide', duration: 1000 }
    });
    window.dispatchEvent(event);
    
    expect(container.classList.contains('opacity-100')).toBe(true);
    
    vi.advanceTimersByTime(1000);
    
    expect(container.classList.contains('opacity-100')).toBe(false);
    expect(container.classList.contains('translate-y-[-100%]')).toBe(true);
  });

  it('durationが0の場合は自動的に隠れないこと', () => {
    new ToastComponent(container);
    
    const event = new CustomEvent('show-toast', {
      detail: { message: 'No auto hide', duration: 0 }
    });
    window.dispatchEvent(event);
    
    vi.advanceTimersByTime(5000);
    
    expect(container.classList.contains('opacity-100')).toBe(true);
  });

  it('閉じるボタンで即座に隠れること', () => {
    new ToastComponent(container);
    
    // 表示
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Test' } }));
    expect(container.classList.contains('opacity-100')).toBe(true);
    
    // 閉じる
    closeButton.click();
    expect(container.classList.contains('opacity-100')).toBe(false);
  });
});
