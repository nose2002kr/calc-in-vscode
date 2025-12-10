import { TextEditor, env } from 'vscode';
import { Engine, EngineResult, EngineRule } from './Engine';

export class CalcEngine extends Engine {
    protected rules: EngineRule[] = [
        {
            // 숫자와 연산자(-+*/)가 번갈아 나타나는 패턴
            // 앞뒤에 '=' 기호가 있을 수 있음
            // 예: "1+2", "=1+2", "1+2=", "=1+2=", "3-1", "4*5", "10/2", "1+2+3", "1+2*3-4" 등
            pattern: /^\s*=?\s*[\d.]+(\s*[-+*/]\s*[\d.]+)+\s*=?\s*$/,
            priority: 1
        }
    ];
    
    private result: number | null = null;

    public process(editor: TextEditor): EngineResult {
        const selectedText = editor.document.getText(editor.selection).trim();
        
        try {
            // '=' 기호 제거 (앞뒤의 = 기호를 trim)
            const expressionWithoutEquals = selectedText.replace(/^\s*=+\s*|\s*=+\s*$/g, '').trim();
            
            // 수식 평가
            // 보안을 위해 숫자와 연산자만 포함된지 확인
            const sanitized = expressionWithoutEquals.replace(/\s+/g, '');
            if (!/^[\d.+\-*/()]+$/.test(sanitized)) {
                throw new Error('Invalid expression');
            }
            
            // 수식 평가
            this.result = this.evaluate(expressionWithoutEquals);
            
            // 결과 포맷팅 (소수점이 없으면 정수로, 있으면 소수점 표시)
            const formattedResult = this.result % 1 === 0 ? this.result.toString() : this.result.toFixed(10).replace(/\.?0+$/, '');
            
            return {
                text: `Calc: ${formattedResult}`,
                copyText: formattedResult
            };
        } catch (error) {
            return {
                text: `Calc: Error`,
                copyText: ''
            };
        }
    }

    public initCommands(commandNamePrefix: string): Array<[string, () => void]> {
        return [
            [`${commandNamePrefix}.copyToClipboard`, () => {
                if (this.result !== null) {
                    const formattedResult = this.result % 1 === 0 
                        ? this.result.toString() 
                        : this.result.toFixed(10).replace(/\.?0+$/, '');
                    env.clipboard.writeText(formattedResult);
                }
            }]
        ];
    }

    /**
     * 수식을 안전하게 평가
     * @param expression 수식 문자열
     * @returns 평가 결과
     */
    private evaluate(expression: string): number {
        // 공백 제거
        const cleaned = expression.replace(/\s+/g, '');
        
        // 간단한 검증: 숫자와 연산자만 포함되어야 함
        if (!/^[\d.+\-*/()]+$/.test(cleaned)) {
            throw new Error('Invalid characters in expression');
        }
        
        try {
            // 괄호 처리 및 연산자 우선순위를 고려한 평가
            return this.evaluateExpression(cleaned);
        } catch (error) {
            throw new Error('Evaluation failed');
        }
    }

    /**
     * 수식을 파싱하여 평가 (사칙연산 우선순위 고려)
     * @param expr 수식 문자열
     * @returns 평가 결과
     */
    private evaluateExpression(expr: string): number {
        let index = 0;

        const parseExpression = (): number => {
            let result = parseTerm();
            while (index < expr.length) {
                const op = expr[index];
                if (op === '+' || op === '-') {
                    index++;
                    const term = parseTerm();
                    result = op === '+' ? result + term : result - term;
                } else {
                    break;
                }
            }
            return result;
        };

        const parseTerm = (): number => {
            let result = parseFactor();
            while (index < expr.length) {
                const op = expr[index];
                if (op === '*' || op === '/') {
                    index++;
                    const factor = parseFactor();
                    if (op === '*') {
                        result *= factor;
                    } else {
                        if (factor === 0) {
                            throw new Error('Division by zero');
                        }
                        result /= factor;
                    }
                } else {
                    break;
                }
            }
            return result;
        };

        const parseFactor = (): number => {
            if (index >= expr.length) {
                throw new Error('Unexpected end of expression');
            }

            if (expr[index] === '(') {
                index++; // '(' 건너뛰기
                const result = parseExpression();
                if (index >= expr.length || expr[index] !== ')') {
                    throw new Error('Unmatched parenthesis');
                }
                index++; // ')' 건너뛰기
                return result;
            }

            if (expr[index] === '+' || expr[index] === '-') {
                const sign = expr[index] === '-' ? -1 : 1;
                index++;
                return sign * parseFactor();
            }

            let numStr = '';
            while (index < expr.length && /[\d.]/.test(expr[index])) {
                numStr += expr[index];
                index++;
            }

            if (numStr === '') {
                throw new Error('Expected number');
            }

            const num = parseFloat(numStr);
            if (isNaN(num) || !isFinite(num)) {
                throw new Error('Invalid number');
            }

            return num;
        };

        const result = parseExpression();
        if (index < expr.length) {
            throw new Error('Unexpected character');
        }
        return result;
    }
}

