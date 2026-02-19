import pako from "pako"

// URL を介したコードの共有（圧縮・エンコード・同期）を担当する
export class Share {
  // コードを圧縮して共有可能な URL を生成する
  compress(code: string): string {
    const compressed = pako.deflate(code)
    const base64 = btoa(String.fromCharCode(...compressed))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    
    const url = new URL(window.location.href)
    url.hash = `code=${base64}`
    return url.toString()
  }

  // URL ハッシュからコードを復元する
  decompress(hash: string | null): string | null {
    if (!hash) return null
    try {
      const cleanHash = hash.replace(/^#?code=/, "")
      const base64 = cleanHash.replace(/-/g, "+").replace(/_/g, "/")
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return pako.inflate(bytes, { to: "string" })
    } catch (e) {
      console.warn("[Share] Failed to decompress code:", e)
      return null
    }
  }
  // 埋め込み用の iframe タグを生成する
  generateEmbedTag(code: string): string {
    const url = this.compress(code)
    // embed.html へのリンクに変換 (現在の origin + /embed.html + hash)
    const embedUrl = url.replace(/\/($|#)/, "/embed.html$1")
    
    return `<iframe
  src="${embedUrl}"
  width="100%"
  height="400"
  frameborder="0"
  allowtransparency="true"
  allow="clipboard-write"
  loading="lazy"
></iframe>`
  }

  // Markdown 用のコードブロックを生成する
  generateCodeBlock(code: string): string {
    return "```ruby\n" + code + "\n```"
  }
}
