import { TextEditor, env } from 'vscode';
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
    
    private numbers: number[] = [];

    public process(editor: TextEditor): EngineResult {
        this.numbers.length = 0;

        editor.selections.forEach(selection => {
            let text = editor.document.getText(selection);
            this.numbers.push(...this._getNumber(text));
        });
        
        const sum = this.numbers.reduce((a, b) => a + b, 0);
        
        return {
            text: `Sum: ${sum}`,
            copyText: `${sum}`
        };
    }

    public initCommands(commandNamePrefix: string): Array<[string, () => void]> {
        return [
            [`${commandNamePrefix}.copyToClipboard`, () => {
                const sum = this.numbers.reduce((a, b) => a + b, 0);
                env.clipboard.writeText(`${sum}`);
            }]
        ];
    }

    private _getNumber(doc: string): number[] {
        let lines = doc.trim().split('\n');

        let numLines = lines.map((line) => {
            const nums = line.match(NUMERIC_REGEXP);
            if (nums && nums.length > 0) { return +(nums[0]); }
            else { return 0; }
        });

        return numLines;
    }
}

