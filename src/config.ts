import * as vscode from 'vscode';

export interface SnbtConfig {
	lenientMode: boolean;
}

export function getConfig(): SnbtConfig {
	const config = vscode.workspace.getConfiguration('snbt');
	return {
		lenientMode: config.get<boolean>('lenientMode', false),
	};
}
