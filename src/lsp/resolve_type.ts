import { LSPResponseParser } from './parser';
import type { LSPClient } from './client';
import type { SyncDocument } from './sync';

/**
 * LSP に対して型情報の解決を要求する
 */
export class ResolveType {
  private client: LSPClient;

  constructor(client: LSPClient) {
    this.client = client;
  }

  /**
   * 指定位置の型情報を取得する
   */
  async at(lineNumber: number, column: number): Promise<string | null> {
    if (!this.client) return null;

    const response = await this.client.sendRequest("textDocument/hover", {
      textDocument: { uri: "inmemory:///workspace/main.rb" },
      position: { line: lineNumber - 1, character: column - 1 }
    });

    if (!response || !response.contents) return null;

    let markdownContent: string = "";
    if (typeof response.contents === "string") {
      markdownContent = response.contents;
    } else if (typeof response.contents === "object" && response.contents.value) {
      markdownContent = response.contents.value;
    }

    const parsed = LSPResponseParser.parseClassNameFromHover(markdownContent);
    return parsed;
  }

  /**
   * 一時的なコンテンツを使用してプローブ（調査）を行う
   */
  async probe(tempContent: string, lineNumber: number, column: number, synchronizer: SyncDocument): Promise<string | null> {
    if (!this.client || !synchronizer) return null;
    
    // 1. 一時コンテンツを送信
    await synchronizer.sendTemporaryContent(tempContent);
    
    // 2. 型解決
    const type = await this.at(lineNumber, column);
    
    // 3. 元の状態に戻す
    await synchronizer.restoreOriginalContent();
    
    return type;
  }
}
