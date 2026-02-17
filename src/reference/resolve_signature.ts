import { URLGenerator } from "./url_generator"
import type { LSPClient } from "../lsp/client"

// Ruby VM (RBS) を使用して、特定のメソッド名に対応する最適なシグネチャを解決する
export class ResolveSignature {
  private client: LSPClient

  constructor(lspClient: LSPClient) {
    this.client = lspClient
  }

  // クラス名とメソッド名から情報を解決する
  async resolve(className: string, methodName: string): Promise<{
    signature: string
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } | null> {
    try {
      // Ruby VM (server.rb) の rubbit.resolveSignature コマンドを呼び出す
      const result = await this.client.sendRequest("workspace/executeCommand", {
        command: "rubbit.resolveSignature",
        arguments: [className, methodName]
      })

      if (!result || !result.signature) {
        return null
      }

      const MODULE_FUNCTION_CLASSES = ["Kernel", "Math", "Process", "FileTest", "GC"]

      if (MODULE_FUNCTION_CLASSES.includes(result.className) && (result.separator === "." || result.signature.includes(".base"))) {
          // モジュール関数の特異メソッド扱いで返ってくるが、実態はモジュール関数としてドキュメントがある場合などを考慮
          // ただし、単純な置換ではURL生成がうまくいかない可能性があるため、
          // generateUrlInfoFromComponents を使う以上、separator を強制的に変えるアプローチをとる
          // ここでは簡易的に、Kernel等のメソッドで特異メソッドとして検出されたものをモジュール関数として扱うロジックを維持する
          
          // result.separator が "." なら本来は特異メソッド(s)。これをモジュール関数(m)にしたい場合、
          // generateUrlInfoFromComponents は separator="#" で "i", separator="." で "s" を返す仕様。
          // "m" を返す仕様は URLGenerator にはないため、生成された URL を置換する既存のアプローチを踏襲する
      }

      const info = URLGenerator.generateUrlInfoFromComponents(
        result.className,
        result.methodName,
        result.separator
      )
      
      // 特例: Math, Kernel などのモジュールのメソッドとして検出された場合、
      // 実態がモジュール関数（かつ暗黙的メソッド）の場合はモジュール関数のURL (/m/) に誘導する
      // generateUrlInfoFromComponents は /s/ か /i/ しか生成しないため、ここで置換を行う
      if (MODULE_FUNCTION_CLASSES.includes(result.className) && (info.url.includes("/s/") || info.url.includes("/i/"))) {
          info.url = info.url.replace(/\/[si]\//, "/m/")
      }

      return {
        signature: result.signature,
        ...info
      }
    } catch (e) {
      console.error(e)
      return null
    }
  }
}
