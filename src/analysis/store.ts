import { ScannedMethod } from "./scanner"

export type MethodItem = ScannedMethod & {
  status: 'pending' | 'resolving' | 'resolved' | 'unknown'
  className?: string | null
  url?: string | null
  separator?: string
  isResolving?: boolean
}

// 解析結果（メソッドリストとその状態）を中央管理し、変更を通知する
export class AnalysisStore {
  private methods: Map<string, MethodItem>
  public firstScanDone: boolean

  constructor() {
    this.methods = new Map<string, MethodItem>() // { "name:line:col": { name, line, col, status, ... } }
    this.firstScanDone = false
  }


  set(id: string, state: MethodItem): void {
    this.methods.set(id, state)
  }

  getAll(): MethodItem[] {
    return Array.from(this.methods.values())
  }

  get(id: string): MethodItem | undefined {
    return this.methods.get(id)
  }


  keepOnly(currentIds: Set<string>): boolean {
    let changed = false
    for (const id of this.methods.keys()) {
      if (!currentIds.has(id)) {
        this.methods.delete(id)
        changed = true
      }
    }
    return changed
  }
  
  setFirstScanDone(done: boolean): void {
    this.firstScanDone = done
  }

  notify(): void {
    const event = new CustomEvent("rubox:analysis-updated", {
      detail: { 
        methods: this.getAll(),
        firstScanDone: this.firstScanDone
      }
    })
    window.dispatchEvent(event)
  }
}
