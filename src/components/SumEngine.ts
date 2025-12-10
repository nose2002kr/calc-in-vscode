import { TextEditor, env, Selection } from 'vscode';
import { Engine, EngineResult, EngineRule } from './Engine';

// from https://stackoverflow.com/a/42264780/1013
const NUMERIC_REGEXP = /[-]{0,1}[\d]*[\.]{0,1}[\d]+/g;

export class SumEngine extends Engine {
    protected rules: EngineRule[] = [
        {
            pattern: NUMERIC_REGEXP, // 숫자가 하나 이상 있는 경우
            priority: 10
        }
    ];
    
    private result: EngineResult | null = null;

    public process(editor: TextEditor, selections: readonly Selection[]): EngineResult {
        const numbers: number[] = [];

        selections.forEach(selection => {
            let text = editor.document.getText(selection);
            numbers.push(...this._getNumbers(text));
        });
        
        const sum = numbers.reduce((a, b) => a + b, 0);
        
        return this.result = {
            text: `Sum: ${sum}`,
            copyText: sum.toString()
        };
    }

    public initCommands(commandNamePrefix: string): Array<[string, () => void]> {
        return [
            [`${commandNamePrefix}.copyToClipboard`, () => {
                env.clipboard.writeText(this.result?.copyText ?? '');
            }]
        ];
    }

    private _getNumbers(doc: string): number[] {
        let lines = doc.trim().split('\n');

        let numLines = lines.map((line) => {
            const nums = line.match(NUMERIC_REGEXP);
            if (nums && nums.length > 0) { return +(nums[0]); }
            else { return 0; }
        });

        return numLines;
    }
}

