import * as vscode from 'vscode';

export interface SnbtConfig {
	lenientMode: boolean;
	indentSize: number;
	useTabs: boolean;
}

export const CONFIG: SnbtConfig = {
	lenientMode: false,
	indentSize: 4,
	useTabs: false,
};

/**
 * Reload all config values from VS Code settings.
 * Call this on activation and on DidChangeConfiguration.
 */
export function reload(): void {
	const raw = vscode.workspace.getConfiguration('snbt');
	CONFIG.lenientMode = raw.get<boolean>('lenient', false);
	CONFIG.indentSize = raw.get<number>('format.indentSize', 4);
	CONFIG.useTabs = raw.get<boolean>('format.useTabs', false);
}
