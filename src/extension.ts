import * as vscode from 'vscode';
import { parse, ParseError as SnbtParseError } from './parser';
import { getConfig } from './config';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
	diagnosticCollection = vscode.languages.createDiagnosticCollection('snbt');

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
			if (event.affectsConfiguration('snbt.lenientMode')) {
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
