import * as vscode from 'vscode';
import { parse } from './parser';
import { getConfig } from './config';
import { formatNode, FormatOptions } from './formatter';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
	diagnosticCollection = vscode.languages.createDiagnosticCollection('snbt');

	// Toggle command
	context.subscriptions.push(
		vscode.commands.registerCommand('snbt.toggleLenientMode', () => {
			const config = vscode.workspace.getConfiguration('snbt');
			const current = config.get<boolean>('lenient', false);
			config.update('lenient', !current, vscode.ConfigurationTarget.Global);
			vscode.window.setStatusBarMessage(
				`SNBT Lenient Mode: ${!current ? 'ON' : 'OFF'}`,
				3000
			);
		})
	);

	// Formatter
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('snbt', {
			provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
				const text = document.getText();
				const lenient = getConfig().lenientMode;
				const result = parse(text, { lenient });

				if (!result.ast || result.errors.length > 0) {
					return [];
				}

				const fmt: FormatOptions = {
					indentSize: vscode.workspace.getConfiguration('snbt').get<number>('format.indentSize', 4),
					useTabs: vscode.workspace.getConfiguration('snbt').get<boolean>('format.useTabs', false),
				};

				const formatted = formatNode(result.ast, fmt) + '\n';
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
			if (event.affectsConfiguration('snbt.lenient')) {
				vscode.window.setStatusBarMessage(
					`SNBT Lenient Mode: ${getConfig().lenientMode ? 'ON' : 'OFF'}`,
					3000
				);
				vscode.workspace.textDocuments.forEach(doc => {
					if (doc.languageId === 'snbt') {
						validateDocument(doc);
					}
				});
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
	const lenient = getConfig().lenientMode;
	const text = document.getText();
	const result = parse(text, { lenient });

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
