import { TextEditor, env } from 'vscode';
import { Engine, EngineResult, EngineRule } from './Engine';

// from https://stackoverflow.com/a/42264780/1013
const NUMERIC_REGEXP = /[-]{0,1}[\d]*[\.]{0,1}[\d]+/g;

enum DateFormat {
    UTC, ISO, LOCAL
}

export class EpochEngine extends Engine {
    protected rules: EngineRule[] = [
        {
            // 타임스탬프로 보이는 긴 숫자 (10자리 이상, 단일 숫자)
            pattern: /^\s*\d{10,}\s*$/,
            priority: 5
        },
        {
            // 숫자가 하나만 있는 경우
            pattern: /^\s*\d+\s*$/,
            priority: 15
        }
    ];
    
    private time: number = 0;
    private dateString: string = '';
    private dateFormat = DateFormat.LOCAL;

    public process(editor: TextEditor): EngineResult {
        const text = editor.document.getText(editor.selection);
        const numbers = this._getNumber(text);
        this.time = numbers[0] || 0;
        this.updateText();
        
        return {
            text: `Date: ${this.dateString}`,
            copyText: this.dateString
        };
    }

    public initCommands(commandNamePrefix: string): Array<[string, () => void]> {
        return [
            [`${commandNamePrefix}.copyToClipboard`, () => {
                env.clipboard.writeText(`${this.dateString}`);
            }],
            [`${commandNamePrefix}.switchDateFormat`, () => {
                this.dateFormat = (this.dateFormat + 1) % 3;
                // updateText는 process에서 호출되므로 여기서는 직접 호출하지 않음
            }]
        ];
    }
    
    private updateText() {
        switch (this.dateFormat) {
            case DateFormat.UTC:
                this.dateString = new Date(this.time).toUTCString();
                break;
            case DateFormat.ISO:
                this.dateString = new Date(this.time).toISOString();
                break;
            case DateFormat.LOCAL:
                this.dateString = new Date(this.time).toLocaleString(env.language ?? 'en-US', {
                    timeZoneName:'longOffset',
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    fractionalSecondDigits: 3
                });
                break;
        }
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
    
    // dateFormat getter for external access
    public getDateFormat(): DateFormat {
        return this.dateFormat;
    }
    
    public setDateFormat(format: DateFormat) {
        this.dateFormat = format;
    }
}

