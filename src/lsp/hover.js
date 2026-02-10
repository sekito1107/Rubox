import * as monaco from 'monaco-editor'

/**
 * Monaco Editor に Hover 情報を提供する
 */
export class ProvideHover {
  constructor(client) {
    this.client = client
  }

  /**
   * プロバイダを登録する
   */
  start() {
    monaco.languages.registerHoverProvider("ruby", {
      provideHover: async (model, position) => {
        try {
          const response = await this.client.sendRequest("textDocument/hover", {
            textDocument: { uri: "inmemory:///workspace/main.rb" },
            position: {
              line: position.lineNumber - 1, 
              character: position.column - 1
            }
          })

          if (!response || !response.contents) return null

          let markdownContent = response.contents
          if (typeof markdownContent === "object" && markdownContent.value) {
            markdownContent = markdownContent.value
          }

          const wordInfo = model.getWordAtPosition(position)
          const expression = wordInfo ? wordInfo.word : ""

          let additionalContents = []
          
          if (this.shouldShowEvaluateLink(model, position, wordInfo, markdownContent)) {
            const params = { expression: expression, line: position.lineNumber, character: position.column }
            const measureCmd = `command:typeprof.measureValue?${encodeURIComponent(JSON.stringify(params))}`
            additionalContents.push({ value: `[Evaluate: ${expression}](${measureCmd})` })
          }

          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            contents: [
              { value: markdownContent, isTrusted: true },
              ...additionalContents.map(c => ({ value: c.value, isTrusted: true }))
            ]
          }
        } catch (e) {
          return null
        }
      }
    })
  }

  shouldShowEvaluateLink(model, position, wordInfo, markdownContent) {
    if (!wordInfo) return false
    const expression = wordInfo.word
    
    const isMethod = markdownContent.includes('#') || (markdownContent.includes('.') && !markdownContent.includes('..'))
    const isKeyword = [
      "if", "else", "elsif", "end", "def", "class", "module", "do", "begin", "rescue", "ensure",
      "puts", "p", "yield", "require", "require_relative", "include", "extend", "module_function",
      "self", "nil", "true", "false"
    ].includes(expression)
    
    const charBefore = wordInfo.startColumn > 1 ? model.getValueInRange(new monaco.Range(
      position.lineNumber, wordInfo.startColumn - 1,
      position.lineNumber, wordInfo.startColumn
    )) : ""
    const isSymbol = charBefore === ':'

    const lineContent = model.getLineContent(position.lineNumber)
    const textBefore = lineContent.substring(0, position.column - 1)
    const quoteCount = (textBefore.match(/['"]/g) || []).length
    const isInsideString = quoteCount % 2 !== 0 && !markdownContent.includes('#')

    return expression && !isMethod && !isKeyword && !isSymbol && !isInsideString
  }
}
