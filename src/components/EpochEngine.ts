import { TextEditor, env, Selection } from 'vscode';
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
    
    private dateFormat = DateFormat.LOCAL;
    private result: EngineResult | null = null;

    public process(editor: TextEditor, selections: readonly Selection[]): EngineResult {
        const selection = selections[0];
        if (!selection) {
            return {
                text: `Date: Error`,
                copyText: ''
            };
        }

        const text = editor.document.getText(selection);
        const time  = this._getNumber(text);
        const dateString = this.formatDate(time);
        
        return this.result = {
            text: `Date: ${dateString}`,
            copyText: dateString
        };
    }

    public initCommands(commandNamePrefix: string): Array<[string, () => void]> {
        return [
            [`${commandNamePrefix}.copyToClipboard`, () => {
                env.clipboard.writeText(this.result?.copyText ?? '');
            }],
            [`${commandNamePrefix}.switchDateFormat`, () => {
                this.dateFormat = (this.dateFormat + 1) % 3;
                // updateText는 process에서 호출되므로 여기서는 직접 호출하지 않음
            }]
        ];
    }
    
    private formatDate(time: number): string {
        switch (this.dateFormat) {
            case DateFormat.UTC:
                return new Date(time).toUTCString();
            case DateFormat.ISO:
                return new Date(time).toISOString();
            case DateFormat.LOCAL:
                return new Date(time).toLocaleString(env.language ?? 'en-US', {
                    timeZoneName:'longOffset',
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    fractionalSecondDigits: 3
                });
        }
    }

    private _getNumber(doc: string): number {
        let lines = doc.trim().split('\n');

        let numLines = lines.map((line) => {
            const nums = line.match(NUMERIC_REGEXP);
            if (nums && nums.length > 0) { return +(nums[0]); }
            else { return 0; }
        });

        return numLines[0] || 0;
    }
    
    // dateFormat getter for external access
    public getDateFormat(): DateFormat {
        return this.dateFormat;
    }
    
    public setDateFormat(format: DateFormat) {
        this.dateFormat = format;
    }
}

