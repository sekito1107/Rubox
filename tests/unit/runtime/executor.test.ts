import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../../../src/runtime/executor';

describe('Executor', () => {
  let mockController: any;
  let executor: Executor;

  beforeEach(() => {
    mockController = {
      run: vi.fn()
    };
    executor = new Executor(mockController);
  });

  describe('execute', () => {
    it('指定されたコードで controller.run を呼び出すこと', () => {
      const code = 'puts "hello"';
      executor.execute(code);
      expect(mockController.run).toHaveBeenCalledWith(code, undefined);
    });

    it('コードが空の場合は何もしないこと', () => {
      executor.execute('');
      expect(mockController.run).not.toHaveBeenCalled();
    });

    it('コードが null または undefined の場合は何もしないこと', () => {
      executor.execute(null as any);
      executor.execute(undefined as any);
      expect(mockController.run).not.toHaveBeenCalled();
    });

    it('stdin が指定された場合に controller.run に渡すこと', () => {
      const code = 'puts gets';
      const stdin = 'hello';
      executor.execute(code, stdin);
      expect(mockController.run).toHaveBeenCalledWith(code, stdin);
    });
  });
});
