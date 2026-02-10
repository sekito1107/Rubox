import pako from "pako"

/**
 * URL を介したコードの共有（圧縮・エンコード・同期）を担当する
 */
export class Share {
  /**
   * コードを圧縮して共有可能な URL を生成する
   */
  compress(code) {
    const compressed = pako.deflate(code)
    const base64 = btoa(String.fromCharCode(...compressed))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    
    const url = new URL(window.location.href)
    url.hash = `code=${base64}`
    return url.toString()
  }

  /**
   * URL ハッシュからコードを復元する
   */
  decompress(hash) {
    if (!hash) return null
    try {
      // Remove 'code=' prefix if exists
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
}
