import { TextEditor, Selection } from 'vscode';

export interface EngineResult {
    text: string;
    copyText?: string;
}

export interface EngineRule {
    pattern: RegExp;
    priority: number; // 낮을수록 우선순위가 높음
    forced?: boolean; // 강제 선택 여부
}

export abstract class Engine {
    protected abstract rules: EngineRule[];
    
    /**
     * 선택된 텍스트가 이 엔진에 매칭되는지 확인
     * @param text 선택된 텍스트
     * @returns 매칭 여부
     */
    public matches(text: string): boolean {
        for (const rule of this.rules) {
            // 정규표현식의 lastIndex를 리셋하여 일관된 결과 보장
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(text)) {
                rule.pattern.lastIndex = 0;
                return true;
            }
        }
        return false;
    }
    
    /**
     * 엔진의 우선순위를 반환 (낮을수록 우선순위가 높음)
     * @param text 선택된 텍스트
     * @returns 우선순위 (매칭되지 않으면 Infinity, forced가 true면 0)
     */
    public getPriority(text: string): number {
        for (const rule of this.rules) {
            // 정규표현식의 lastIndex를 리셋하여 일관된 결과 보장
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(text)) {
                rule.pattern.lastIndex = 0;
                // forced가 true면 priority를 0으로 간주
                return rule.forced === true ? 0 : rule.priority;
            }
        }
        return Infinity;
    }
    
    /**
     * 첫 번째 룰의 forced 상태를 설정
     * @param forced 강제 선택 여부
     */
    public setForced(forced: boolean): void {
        if (this.rules.length > 0) {
            this.rules[0].forced = forced;
        }
    }
    
    /**
     * 첫 번째 룰의 forced 상태를 반환
     * @returns forced 상태 (기본값 false)
     */
    public getForced(): boolean {
        return this.rules.length > 0 ? (this.rules[0].forced === true) : false;
    }
    
    /**
     * 선택된 텍스트를 처리하여 결과를 반환
     * @param editor 현재 에디터
     * @param selections 선택된 영역 배열
     * @returns 처리 결과
     */
    abstract process(editor: TextEditor, selections: readonly Selection[]): EngineResult;
    
    /**
     * 엔진별 커맨드 초기화
     * @param commandNamePrefix 커맨드 이름 접두사
     * @returns 커맨드 배열 [commandName, handler]
     */
    abstract initCommands(commandNamePrefix: string): Array<[string, () => void]>;
}

