import * as vscode from 'vscode';
import { parse } from './parser';
import { reload as reloadConfig, CONFIG  } from './config';
import { formatNode } from './formatter';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
	reloadConfig();
	diagnosticCollection = vscode.languages.createDiagnosticCollection('snbt');

	// Toggle command
	context.subscriptions.push(
		vscode.commands.registerCommand('snbt.toggleLenientMode', () => {
			const next = !CONFIG.lenientMode;
			vscode.workspace.getConfiguration('snbt').update('lenient', next);
			CONFIG.lenientMode = next;
			vscode.window.setStatusBarMessage(
				`SNBT Lenient Mode: ${next ? 'ON' : 'OFF'}`,
				3000
			);
		})
	);

	// Formatter
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('snbt', {
			provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
				const text = document.getText();
				const result = parse(text, { lenient: CONFIG.lenientMode });

				if (!result.ast || result.errors.length > 0) {
					return [];
				}

				const formatted = formatNode(result.ast, {
					indentSize: CONFIG.indentSize,
					useTabs: CONFIG.useTabs,
				}) + '\n';

				const range = new vscode.Range(0, 0, document.lineCount, 0);
				return [vscode.TextEdit.replace(range, formatted)];
			}
		})
	);

	// Active editor changed
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor?.document.languageId === 'snbt') {
				validateDocument(editor.document);
			}
		})
	);

	// Document content changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.languageId === 'snbt') {
				validateDocument(event.document);
			}
		})
	);

	// Configuration changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('snbt')) {
				reloadConfig();
			}
		})
	);

	// Initial validation
	vscode.window.visibleTextEditors.forEach(editor => {
		if (editor.document.languageId === 'snbt') {
			validateDocument(editor.document);
		}
	});

	context.subscriptions.push(diagnosticCollection);
}

export function deactivate() {
	// subscriptions handle cleanup
}

function validateDocument(document: vscode.TextDocument): void {
	const text = document.getText();
	const result = parse(text, { lenient: CONFIG.lenientMode });

	const diagnostics: vscode.Diagnostic[] = result.errors.map(err => {
		const range = new vscode.Range(
			err.line - 1,
			err.column - 1,
			err.line - 1,
			err.column - 1 + Math.max(err.length, 1)
		);
		return new vscode.Diagnostic(
			range,
			err.message,
			vscode.DiagnosticSeverity.Error
		);
	});

	diagnosticCollection.set(document.uri, diagnostics);
}
