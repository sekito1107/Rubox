// エディタの内容をファイルとしてダウンロード（エクスポート）する
export interface EditorLike {
  getValue(): string;
}

export class Exporter {
  private editor: EditorLike;

  constructor(editor: EditorLike) {
    this.editor = editor;
  }

  // 現在のコンテンツを .rb ファイルとして保存する
  // 現在のコンテンツを .rb ファイルとして保存する
  // filename: 保存するファイル名 (デフォルト: "main.rb")
  async export(filename: string = "main.rb"): Promise<void> {
    const code = this.editor.getValue();

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Ruby Source File',
            accept: { 'text/plain': ['.rb'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(code);
        await writable.close();
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.warn("File System Access API failed, falling back to download link.", e);
      }
    }

    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
