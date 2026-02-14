import { describe, it, expect } from 'vitest';
import { LSPResponseParser } from '../../../src/lsp/parser';

describe('LSPResponseParser', () => {
  describe('parseClassNameFromHover', () => {
    it('Class#method 形式のシグネチャをパースできること', () => {
      const content = 'String#upcase';
      expect(LSPResponseParser.parseClassNameFromHover(content)).toBe('String');
    });

    it('Class.method 形式のシグネチャをパースできること', () => {
      const content = 'File.open';
      expect(LSPResponseParser.parseClassNameFromHover(content)).toBe('File');
    });

    it('ブラケット表記から Array を特定できること', () => {
      expect(LSPResponseParser.parseClassNameFromHover('[Integer, String]')).toBe('Array');
      expect(LSPResponseParser.parseClassNameFromHover('Array[Integer]')).toBe('Array');
    });

    it('rubyコードブロックからパースできること', () => {
      const content = '```ruby\nHash\n```';
      expect(LSPResponseParser.parseClassNameFromHover(content)).toBe('Hash');
    });

    it('ジェネリクスを含む複雑な型名を処理できること', () => {
      expect(LSPResponseParser.parseClassNameFromHover('Enumerator[Integer]')).toBe('Enumerator');
    });

    it('リテラルから Symbol を特定できること', () => {
      expect(LSPResponseParser.parseClassNameFromHover(':foo')).toBe('Symbol');
    });

    it('空または無効なコンテンツに対して null を返すこと', () => {
      expect(LSPResponseParser.parseClassNameFromHover(null)).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('   ')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('lowercase')).toBeNull();
    });
  });

  describe('normalizeTypeName', () => {
    it('ジェネリクスを削除すること', () => {
      expect(LSPResponseParser.normalizeTypeName('Array[String]')).toBe('Array');
    });

    it('リテラルをそのクラス名に正規化すること', () => {
      expect(LSPResponseParser.normalizeTypeName('"hello"')).toBe('String');
      expect(LSPResponseParser.normalizeTypeName("'world'")).toBe('String');
      expect(LSPResponseParser.normalizeTypeName(':sym')).toBe('Symbol');
      expect(LSPResponseParser.normalizeTypeName('true')).toBe('TrueClass');
      expect(LSPResponseParser.normalizeTypeName('false')).toBe('FalseClass');
    });

    it('名前空間 (::) は維持すること', () => {
      expect(LSPResponseParser.normalizeTypeName('Net::HTTP')).toBe('Net::HTTP');
    });

    it('Boolean を Object にマップすること', () => {
      expect(LSPResponseParser.normalizeTypeName('Boolean')).toBe('Object');
    });
  });
});
