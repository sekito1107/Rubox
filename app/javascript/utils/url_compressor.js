import pako from "pako"

// URLセーフなBase64エンコード・デコードと圧縮・展開を行うユーティリティ
export default class UrlCompressor {
  // 文字列を圧縮してURLセーフなBase64文字列に変換する
  // @param {string} text - 圧縮する文字列
  // @returns {string} 圧縮されたBase64文字列
  static compress(text) {
    if (!text) return ""
    
    try {
      // 文字列をバイト配列に変換 (UTF-8)
      const encoded = new TextEncoder().encode(text)
      
      // Deflateアルゴリズムで圧縮
      const compressed = pako.deflate(encoded)
      
      // バイト配列をバイナリ文字列に変換
      // 注意: 大量データの場合はチャンク処理が必要だが、コードスニペット程度ならこれで十分
      let binaryString = ""
      for (let i = 0; i < compressed.length; i++) {
        binaryString += String.fromCharCode(compressed[i])
      }
      
      // Base64エンコード
      const base64 = btoa(binaryString)
      
      // URLセーフに置換 (+ -> -, / -> _, = 削除)
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    } catch (e) {
      console.error("Compression failed:", e)
      return ""
    }
  }

  // URLセーフなBase64文字列を展開して元の文字列に戻す
  // @param {string} encoded - 圧縮されたBase64文字列
  // @returns {string|null} 展開された文字列。失敗時はnull
  static decompress(encoded) {
    if (!encoded) return ""
    
    try {
      // URLセーフ文字を標準Base64に戻す (- -> +, _ -> /)
      let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
      
      // パディング(=)の復元
      const pad = base64.length % 4
      if (pad) {
        base64 += "=".repeat(4 - pad)
      }
      
      // Base64デコード -> バイナリ文字列
      const binaryString = atob(base64)
      
      // バイナリ文字列をバイト配列に変換
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      // Inflateアルゴリズムで展開
      const decompressed = pako.inflate(bytes)
      
      // バイト配列を文字列に戻す (UTF-8)
      return new TextDecoder().decode(decompressed)
    } catch (e) {
      console.error("Decompression failed:", e)
      return null
    }
  }
}
