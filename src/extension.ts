// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, commands, TextEditor, env } from 'vscode';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Code sum up is now active!');

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(new SumStatusBar().registerCommands(context.subscriptions));
    context.subscriptions.push(new EpochStatusBar().registerCommands(context.subscriptions));
}

// from https://stackoverflow.com/a/42264780/1013
const NUMERIC_REGEXP = /[-]{0,1}[\d]*[\.]{0,1}[\d]+/g;
const EXTENSION_NAME = 'calc-in-editor';
type CommandName = string;

abstract class StatusBar {
    private _disposable: Disposable;
    private _statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    private gone: boolean = false;
    private commands: [string, ()=>void][] = [];
    private name: string;

    constructor(name: string) {
        this.name = name;
        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        
        this.initCommands();

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
        this._statusBarItem.dispose();
    }

    private _onEvent() {
        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor || this.gone) {
            this._statusBarItem.hide();
            return
        }
        this.onSelectedChange(editor);
        this._statusBarItem.show();
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

    protected setText(text: string) {
        this._statusBarItem.text = text;
    }

    private setCommand(command: string | undefined) {
        this._statusBarItem.command = command;
    }
    
    private makeCommandName(command: string): string {
        return `${EXTENSION_NAME}.${this.name}.${command}`;
    }

    public registerCommands(subscriptions: Disposable[]): Disposable {
        this.commands.forEach(([command, func]) => {
            subscriptions.push(commands.registerCommand(command, func));
        });
        return this._disposable;
    }
    
    protected pushCommand(command: [CommandName, ()=>void], defaultCommand: boolean = false) {
        this.commands.push([this.makeCommandName(command[0]), command[1]]);
        if (defaultCommand) {
            if (this._statusBarItem.command) {
                console.warn('Command already set with', this._statusBarItem.command, 'overwriting with', this.makeCommandName(command[0]));
            }
            this.setCommand(this.makeCommandName(command[0]));
        }
    }

    abstract initCommands(): void;
    abstract onSelectedChange(editor: TextEditor): void;
}

class SumStatusBar extends StatusBar {
    constructor() { super('sum'); }
    private numbers: number[] = [];

    public initCommands(): void {
        this.pushCommand(['copyToClipboard', () => { env.clipboard.writeText(`${this.numbers.reduce((a, b) => a + b, 0)}`) }]);
        this.pushCommand(['hideStatusBar', () => { this.toggleHide(); }])
        this.pushCommand(['openQuickPick', async () => {
            const useAltCommand = await window.showQuickPick(
                ['Normal Action', 'Cmd/Alt Click Action'],
                { placeHolder: 'Choose action to simulate click behavior' }
            );
    
            switch (useAltCommand) {
                case 'Normal Action':
                    commands.executeCommand('calc-in-editor.sum.copyToClipboard');
                    break;
                case 'Cmd/Alt Click Action':
                    commands.executeCommand('calc-in-editor.sum.hideStatusBar');
                    break;
            }
        }], true);
    }

    public onSelectedChange(editor: TextEditor) {
        this.numbers.length = 0;

        editor.selections.forEach(selection => {
            let text = editor.document.getText(selection);
            this.numbers.push(...this._getNumber(text));
        });
        
        // Update the status bar
        this.setText(`Sum: ${this.numbers.reduce((a, b) => a + b, 0)}`);
    }

    public _getNumber(doc: string): number[] {
        let lines = doc.trim().split('\n');

        let numLines = lines.map((line) => {
            const nums = line.match(NUMERIC_REGEXP);
            if (nums && nums.length > 0) { return +(nums[0]); }
            else { return 0; }
        });

        return numLines;
    }
}

enum DateFormat {
    UTC, ISO, LOCAL
}
    
class EpochStatusBar extends StatusBar {
    constructor() { super('epoch'); }
    private time: number = 0;
    private dateString: string = '';
    private dateFormat = DateFormat.LOCAL;
    

    public initCommands(): void {
        this.pushCommand(['copyToClipboard', () => { env.clipboard.writeText(`${this.dateString}`) }]);
        this.pushCommand(['hideStatusBar', () => { this.toggleHide(); }])
        this.pushCommand(['switchDateFormat', () => { this.dateFormat = (this.dateFormat + 1) % 3; this.updateText(); }]);
        this.pushCommand(['openQuickPick', async () => {
            const useAltCommand = await window.showQuickPick(
                ['Normal Action', 'Cmd/Alt Click Action', 'switchDateFormat'],
                { placeHolder: 'Choose action to simulate click behavior' }
            );
    
            switch (useAltCommand) {
                case 'Normal Action':
                    commands.executeCommand('calc-in-editor.epoch.copyToClipboard');
                    break;
                case 'Cmd/Alt Click Action':
                    commands.executeCommand('calc-in-editor.epoch.hideStatusBar');
                    break;
                case 'switchDateFormat':
                    commands.executeCommand('calc-in-editor.epoch.switchDateFormat');
                    break;
            }
        }], true);
    }
    
    public onSelectedChange(editor: TextEditor) {
        // Get the current text editor
        this.time = this._getNumber(editor.document.getText(editor.selection))[0]
        this.updateText();
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
                this.dateString = new Date(this.time).toLocaleString();
                break;
        }
        this.setText(`Date: ${this.dateString}`);
    }

    public _getNumber(doc: string): number[] {
        let lines = doc.trim().split('\n');

        let numLines = lines.map((line) => {
            const nums = line.match(NUMERIC_REGEXP);
            if (nums && nums.length > 0) { return +(nums[0]); }
            else { return 0; }
        });

        return numLines;
    }
}
