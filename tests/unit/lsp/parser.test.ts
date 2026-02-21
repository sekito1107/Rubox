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

    it('rubyコードブロックでの配列表記から Array を特定できること', () => {
      const content = '```ruby\n[Integer]\n```';
      expect(LSPResponseParser.parseClassNameFromHover(content)).toBe('Array');
    });

    it('ジェネリクスを含む複雑な型名を処理できること', () => {
      expect(LSPResponseParser.parseClassNameFromHover('Enumerator[Integer]')).toBe('Enumerator');
    });

    it('シンボルリテラル形式（TypeProfのラベル）に対して null を返すこと', () => {
      // TypeProf は型を特定できない場合、:method_name などのシンボル形式ラベルを返す
      // これはクラス名ではないため null を返す
      expect(LSPResponseParser.parseClassNameFromHover(':foo')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover(':my_count')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover(':string')).toBeNull();
    });

    it('空または無効なコンテンツに対して null を返すこと', () => {
      expect(LSPResponseParser.parseClassNameFromHover(null)).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('   ')).toBeNull();
      expect(LSPResponseParser.parseClassNameFromHover('lowercase')).toBeNull();
    });

    it('変数定義のホバーに対して null を返すこと', () => {
      expect(LSPResponseParser.parseClassNameFromHover('  i: Integer  ')).toBeNull();
    });
  });

  describe('parseReturnTypeFromHover', () => {
    it('メソッドシグネチャから戻り値型を抽出できること', () => {
      const content = 'def each_char: () -> Enumerator[String, String]';
      expect(LSPResponseParser.parseReturnTypeFromHover(content)).toBe('Enumerator');
    });

    it('ブロックを伴うシグネチャから戻り値型を抽出できること', () => {
      const content = 'def each: { (Integer) -> void } -> Array[Integer]';
      expect(LSPResponseParser.parseReturnTypeFromHover(content)).toBe('Array');
    });

    it('単純なシグネチャから戻り値型を抽出できること', () => {
      const content = 'def upcase: () -> String';
      expect(LSPResponseParser.parseReturnTypeFromHover(content)).toBe('String');
    });

    it('戻り値型がない場合は null を返すこと', () => {
      expect(LSPResponseParser.parseReturnTypeFromHover('String#upcase')).toBeNull();
      expect(LSPResponseParser.parseReturnTypeFromHover('target: String')).toBeNull();
    });

    it('リテラル戻り値型を正規化すること', () => {
      expect(LSPResponseParser.parseReturnTypeFromHover('def foo: () -> "hello"')).toBe('String');
    });
  });

  describe('parseTypeFromProbe', () => {
    it('変数定義形式から型を抽出できること', () => {
      expect(LSPResponseParser.parseTypeFromProbe('__rubpad_type_probe__: Enumerator[String, String]')).toBe('Enumerator');
    });

    it('変数定義形式から単純な型を抽出できること', () => {
      expect(LSPResponseParser.parseTypeFromProbe('__rubpad_type_probe__: String')).toBe('String');
    });

    it('null/undefined に対して null を返すこと', () => {
      expect(LSPResponseParser.parseTypeFromProbe(null)).toBeNull();
      expect(LSPResponseParser.parseTypeFromProbe(undefined)).toBeNull();
    });
  });

  describe('parseClassNameFromHover (TypeProf レスポンス)', () => {
    it('ジェネリクス付き型名からクラスを抽出すること', () => {
      expect(LSPResponseParser.parseClassNameFromHover('Enumerator[String, String]')).toBe('Enumerator');
    });

    it('-> がない場合は通常通りパースすること', () => {
      expect(LSPResponseParser.parseClassNameFromHover('String#upcase')).toBe('String');
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
