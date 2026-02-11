import { LSPClient } from "./lsp/client";
import { LSP } from "./lsp";
import { AnalysisCoordinator } from "./analysis";
import * as monaco from 'monaco-editor'

declare global {
  interface Window {
    monacoEditor?: monaco.editor.IStandaloneCodeEditor | any; // Allow any for compatibility with legacy code
    __rubyVMInitializing?: boolean;
    __rubyVMReady?: boolean;
    rubyLSP?: LSPClient;
    rubpadLSPManager?: LSP;
    rubpadAnalysisCoordinator?: AnalysisCoordinator;
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker;
    };
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }
}
