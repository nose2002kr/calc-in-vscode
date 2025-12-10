import { window, commands, Disposable, StatusBarAlignment, StatusBarItem, TextEditor } from 'vscode';
import { Engine } from './Engine';
import { CalcEngine } from './CalcEngine';
import { SumEngine } from './SumEngine';
import { EpochEngine } from './EpochEngine';

const EXTENSION_NAME = 'calc-in-editor';

export class CalcStatusBar {
    private _disposable: Disposable;
    private _iconItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 5401);
    private _statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 5400);
    //_statusBarItem.priority = {"location":{"id":"status.scm.0","priority":10000},"alignment":1,"compact":true}
    
    private gone: boolean = false;
    private commands: [string, ()=>void][] = [];
    private engines: Engine[] = [];
    private currentEngine: Engine | null = null;
    private currentEngineIndex: number = 0; // 현재 강제 선택된 엔진 인덱스

    constructor() {
        // 엔진 초기화 (우선순위 순서대로: CalcEngine > EpochEngine > SumEngine)
        this.engines = [
            new CalcEngine(),
            new EpochEngine(),
            new SumEngine()
        ];
        
        // 각 엔진의 커맨드 등록
        this.engines.forEach(engine => {
            const engineName = engine.constructor.name.replace('Engine', '').toLowerCase();
            const commandPrefix = `${EXTENSION_NAME}.${engineName}`;
            const engineCommands = engine.initCommands(commandPrefix);
            
            // EpochEngine의 switchDateFormat 커맨드를 래핑하여 업데이트 트리거
            if (engine instanceof EpochEngine && engineName === 'epoch') {
                const wrappedCommands: Array<[string, () => void]> = [];
                engineCommands.forEach(([cmd, handler]) => {
                    if (cmd.endsWith('.switchDateFormat')) {
                        wrappedCommands.push([cmd, () => {
                            handler();
                            // 날짜 형식 변경 후 상태바 업데이트
                            if (window.activeTextEditor) {
                                this.onSelectedChange(window.activeTextEditor);
                            }
                        }]);
                    } else {
                        wrappedCommands.push([cmd, handler]);
                    }
                });
                this.commands.push(...wrappedCommands);
            } else {
                this.commands.push(...engineCommands);
            }
        });
        
        // 공통 커맨드 추가
        this.initCommands();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        
        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
        this._iconItem.show();
    }

    dispose() {
        this._disposable.dispose();
        this._iconItem.dispose();
        this._statusBarItem.dispose();
    }

    private _onEvent() {
        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor || this.gone) {
            this._statusBarItem.hide();
        } else {
            this._statusBarItem.show();
        }
        this.onSelectedChange(editor);
    }

    public hide() {
        this.gone = true;
        this._statusBarItem.hide();
    }

    public show() {
        this.gone = false;
        this._statusBarItem.show();
    }

    public toggleHide() {
        if (this.gone) {
            this.show();
        } else {
            this.hide();
        }
    }

    private setText(text: string) {
        this._statusBarItem.text = text;
    }

    private setCommand(command: string | undefined) {
        this._statusBarItem.command = command;
    }

    private initCommands() {
        // hideStatusBar 커맨드
        this.commands.push([`${EXTENSION_NAME}.hideStatusBar`, () => {
            this.toggleHide();
        }]);
        
        // 아이콘 클릭 커맨드: engine 순회하여 forced 설정
        this.commands.push([`${EXTENSION_NAME}.cycleEngine`, () => {
            this.cycleEngine();
        }]);
        
        // openQuickPick 커맨드
        this.commands.push([`${EXTENSION_NAME}.openQuickPick`, async () => {
            const options: string[] = ['Normal Action', 'Cmd/Alt Click Action'];
            
            // 현재 엔진이 EpochEngine인 경우 switchDateFormat 옵션 추가
            if (this.currentEngine instanceof EpochEngine) {
                options.push('Switch Date Format');
            }
            
            const useAltCommand = await window.showQuickPick(
                options,
                { placeHolder: 'Choose action to simulate click behavior' }
            );
    
            if (!useAltCommand) return;
            
            switch (useAltCommand) {
                case 'Normal Action':
                    if (this.currentEngine) {
                        const engineName = this.currentEngine.constructor.name.replace('Engine', '').toLowerCase();
                        commands.executeCommand(`${EXTENSION_NAME}.${engineName}.copyToClipboard`);
                    }
                    break;
                case 'Cmd/Alt Click Action':
                    commands.executeCommand(`${EXTENSION_NAME}.hideStatusBar`);
                    break;
                case 'Switch Date Format':
                    if (this.currentEngine instanceof EpochEngine) {
                        const engineName = this.currentEngine.constructor.name.replace('Engine', '').toLowerCase();
                        commands.executeCommand(`${EXTENSION_NAME}.${engineName}.switchDateFormat`);
                        // 날짜 형식 변경 후 다시 업데이트
                        if (window.activeTextEditor) {
                            this.onSelectedChange(window.activeTextEditor);
                        }
                    }
                    break;
            }
        }]);
        
        // 아이콘 아이템 설정
        this._iconItem.text = '$(output-view-icon)'; // 계산기 아이콘 '$(preview)
        this._iconItem.command = `${EXTENSION_NAME}.cycleEngine`;
        this._iconItem.tooltip = 'Cycle through engines';
        
        // 텍스트 아이템 기본 커맨드 설정
        this.setCommand(`${EXTENSION_NAME}.openQuickPick`);
    }
    
    /**
     * 엔진을 순회하여 forced 상태를 설정
     * 현재 selection에 매칭되지 않으면 다음 엔진으로 재수행
     */
    private cycleEngine(): void {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText.trim()) {
            return;
        }
        
        // 모든 엔진의 forced를 false로 설정
        this.engines.forEach(engine => {
            engine.setForced(false);
        });
        
        // 시작 인덱스 저장 (무한 루프 방지)
        let attempts = 0;
        const maxAttempts = this.engines.length;
        
        // 매칭되는 엔진을 찾을 때까지 순환
        while (attempts < maxAttempts) {
            // 현재 인덱스의 엔진을 forced=true로 설정
            const currentEngine = this.engines[this.currentEngineIndex];
            if (currentEngine) {
                currentEngine.setForced(true);
            }
            
            // 현재 엔진이 선택된 텍스트에 매칭되는지 확인
            if (currentEngine && currentEngine.matches(selectedText)) {
                // 매칭되는 엔진을 찾았으므로 상태바 업데이트 후 종료
                if (window.activeTextEditor) {
                    this.onSelectedChange(window.activeTextEditor);
                }
                // 다음 엔진으로 인덱스 이동 (다음 클릭을 위해)
                this.currentEngineIndex = (this.currentEngineIndex + 1) % this.engines.length;
                return;
            }
            
            // 매칭되지 않으면 forced를 false로 되돌리고 다음 엔진으로 이동
            if (currentEngine) {
                currentEngine.setForced(false);
            }
            this.currentEngineIndex = (this.currentEngineIndex + 1) % this.engines.length;
            attempts++;
        }
    }

    public registerCommands(subscriptions: Disposable[]): Disposable {
        this.commands.forEach(([command, func]) => {
            subscriptions.push(commands.registerCommand(command, func));
        });
        return this._disposable;
    }

    public onSelectedChange(editor: TextEditor | undefined) {
        if (!editor) {
            this.hide()
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText.trim()) {
            this.hide()
            return;
        }
        
        // 모든 엔진 중에서 매칭되는 엔진 찾기
        // forced가 true인 엔진을 우선적으로 선택
        let bestEngine: Engine | null = null;
        let bestPriority = Infinity;
        let forcedEngine: Engine | null = null;
        let forcedPriority = Infinity;
        
        for (const engine of this.engines) {
            if (engine.matches(selectedText)) {
                const priority = engine.getPriority(selectedText);
                const isForced = engine.getForced();
                
                if (isForced) {
                    // forced가 true인 엔진 중에서 가장 낮은 priority 선택
                    if (priority < forcedPriority) {
                        forcedPriority = priority;
                        forcedEngine = engine;
                    }
                } else {
                    // forced가 false인 엔진 중에서 가장 낮은 priority 선택
                    if (priority < bestPriority) {
                        bestPriority = priority;
                        bestEngine = engine;
                    }
                }
            }
        }
        
        // forced 엔진이 있으면 그것을 우선 선택, 없으면 일반 엔진 선택
        const selectedEngine = forcedEngine || bestEngine;
        
        // 매칭되는 엔진이 없으면 숨김
        if (!selectedEngine) {
            this.hide()
            return;
        }
        
        // 엔진 변경 시 날짜 형식 업데이트 (EpochEngine인 경우)
        if (selectedEngine instanceof EpochEngine && this.currentEngine instanceof EpochEngine) {
            const epochEngine = selectedEngine as EpochEngine;
            const currentEpochEngine = this.currentEngine as EpochEngine;
            epochEngine.setDateFormat(currentEpochEngine.getDateFormat());
        }
        
        this.currentEngine = selectedEngine;
        
        // 엔진으로 처리
        const result = selectedEngine.process(editor);
        this.setText(result.text);
        this.show()
    }
}
