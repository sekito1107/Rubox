import * as monaco from 'monaco-editor';
import type { LSPClient } from './client';

/**
 * Monaco Editor に Hover 情報を提供する
 */
export class ProvideHover {
  private client: LSPClient;

  constructor(client: LSPClient) {
    this.client = client;
  }

  /**
   * プロバイダを登録する
   */
  start(): void {
    monaco.languages.registerHoverProvider("ruby", {
      provideHover: async (model: monaco.editor.ITextModel, position: monaco.Position) => {
        try {
          const response = await this.client.sendRequest("textDocument/hover", {
            textDocument: { uri: "inmemory:///workspace/main.rb" },
            position: {
              line: position.lineNumber - 1, 
              character: position.column - 1
            }
          });

          if (!response || !response.contents) return null;

          let markdownContent: string = "";
          if (typeof response.contents === "string") {
            markdownContent = response.contents;
          } else if (typeof response.contents === "object" && response.contents.value) {
            markdownContent = response.contents.value;
          }

          const wordInfo = model.getWordAtPosition(position);
          const expression = wordInfo ? wordInfo.word : "";

          let additionalContents: { value: string; isTrusted: boolean }[] = [];
          
          if (this.shouldShowEvaluateLink(model, position, wordInfo, markdownContent)) {
            const params = { expression: expression, line: position.lineNumber - 1, character: position.column };
            const measureCmd = `command:typeprof.measureValue?${encodeURIComponent(JSON.stringify(params))}`;
            additionalContents.push({ value: `[値を確認: ${expression}](${measureCmd})`, isTrusted: true });
          }

          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            contents: [
              { value: markdownContent, isTrusted: true },
              ...additionalContents
            ]
          };
        } catch (e) {
          return null;
        }
      }
    });
  }

  private shouldShowEvaluateLink(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    wordInfo: monaco.editor.IWordAtPosition | null,
    markdownContent: string
  ): boolean {
    if (!wordInfo) return false;
    const expression = wordInfo.word;
    
    const isMethod = markdownContent.includes('#') || (markdownContent.includes('.') && !markdownContent.includes('..'));
    const isKeyword = [
      "if", "else", "elsif", "end", "def", "class", "module", "do", "begin", "rescue", "ensure",
      "puts", "p", "yield", "require", "require_relative", "include", "extend", "module_function",
      "self", "nil", "true", "false"
    ].includes(expression);
    
    const charBefore = wordInfo.startColumn > 1 ? model.getValueInRange(new monaco.Range(
      position.lineNumber, wordInfo.startColumn - 1,
      position.lineNumber, wordInfo.startColumn
    )) : "";
    const isSymbol = charBefore === ':';

    const lineContent = model.getLineContent(position.lineNumber);
    const textBefore = lineContent.substring(0, position.column - 1);
    const quoteCount = (textBefore.match(/['"]/g) || []).length;
    const isInsideString = quoteCount % 2 !== 0 && !markdownContent.includes('#');

    return !!expression && !isMethod && !isKeyword && !isSymbol && !isInsideString;
  }
}
