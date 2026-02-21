import { LSPClient } from "./lsp/client";
import { LSP } from "./lsp";
import { AnalysisCoordinator } from "./analysis";
import * as monaco from "monaco-editor";

declare global {
  interface Window {
    monacoEditor?: monaco.editor.IStandaloneCodeEditor | any; // 以前のコードとの互換性のために any を許可
    rubyLSP?: LSPClient;
    ruboxLSPManager?: LSP;
    ruboxLSPReady?: boolean;
    ruboxAnalysisCoordinator?: AnalysisCoordinator;
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker;
    };
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
    monaco?: any;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }
}
