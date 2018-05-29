import {
	workspace,
	window,
	commands,
	ExtensionContext,
	TextEditorSelectionChangeEvent,
	TextDocumentChangeEvent,
	TextDocumentContentProvider,
	EventEmitter,
	ViewColumn,
	Uri,
	Event,
	Disposable,
	TextDocument,
	TextEditor
} from "vscode";

import * as path from "path";
const Viz = require("viz.js");

export class GraphvizProvider implements TextDocumentContentProvider {
	static scheme = "graphviz-preview";

	private resultText = "";
	private lastPreviewHTML: string | Thenable<string> | undefined = undefined;
	private lastURI: Uri | undefined = undefined;
	private needsRebuild: boolean = true;
	private editorDocument: TextDocument | undefined = undefined;

	public _onDidChange = new EventEmitter<Uri>();
	public refreshInterval = 1000;

	private resolveDocument(uri: Uri): TextDocument {
		const matches = workspace.textDocuments.filter(d => {
			return makePreviewUri(d).toString() == uri.toString();
		});
		if (matches.length > 0) {
			return matches[0];
		} else {
			return undefined;
		}
	}

	public provideTextDocumentContent(uri: Uri): string | Thenable<string> {
		const doc = this.resolveDocument(uri);
		return this.createAsciiDocHTML(doc);
	}

	get onDidChange(): Event<Uri> {
		return this._onDidChange.event;
	}

	public update(uri: Uri) {
		this._onDidChange.fire(uri);
	}

	private createAsciiDocHTML(doc: TextDocument): string | Thenable<string> {
		// const editor = window.activeTextEditor;

		if (!doc || !(doc.languageId === "dot")) {
			return this.errorSnippet("Editor doesn't show a DOT document - no properties to preview.");
		}

		// Rebuild if there were changes to the file, or if the content is beeing request
		// for a different uri.
		if (this.needsRebuild || doc.uri != this.lastURI) {
			this.lastPreviewHTML = this.preview(doc);
			this.lastURI = doc.uri;
			this.needsRebuild = false
		}
		return this.lastPreviewHTML;
	}

	private errorSnippet(error: string): string {
		return `
                <body>
                    ${error}
                </body>`;
	}

	private buildPage(document: string): string {
		return document;
	}

	public setNeedsRebuild(value: Boolean) {
		this.needsRebuild = true;
	}

	public preview(doc: TextDocument): Thenable<string> {
		const text = doc.getText();
		return new Promise<string>((resolve, reject) => {
			var svg = Viz(text);
			resolve(svg);
		});
	}

}

function timerCallback(timer: NodeJS.Timer, provider: GraphvizProvider, editor: TextEditor, previewUri: Uri) {
	provider._onDidChange.fire(previewUri);
}

export function createRefreshTimer(provider: GraphvizProvider, editor: TextEditor, previewUri: Uri) {
	const timer = setInterval(
		() => {
			// This function gets called when the timer goes off.
			timerCallback(timer, provider, editor, previewUri);
		},
		// The periodicity of the timer.
		provider.refreshInterval
	);
}

export function makePreviewUri(doc: TextDocument): Uri {
	// TODO: Escape?
	return Uri.parse(`graphviz-preview://preview/${doc.fileName}`);
}

export function createHTMLWindow(provider: GraphvizProvider, displayColumn: ViewColumn): PromiseLike<void> {
	const previewTitle = `Preview: "${path.basename(window.activeTextEditor.document.fileName)}"`;
	const previewUri = makePreviewUri(window.activeTextEditor.document);

	createRefreshTimer(provider, window.activeTextEditor, previewUri);

	return commands.executeCommand("vscode.previewHtml", previewUri, displayColumn)
		.then((success) => {}, (reason) => {
			console.warn(reason);
			window.showErrorMessage(reason);
		});
}
