import { window, workspace, ExtensionContext, Disposable, TextDocumentChangeEvent, ViewColumn, TextDocument, TextEditorSelectionChangeEvent, commands } from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions /* TransportKind */
} from "vscode-languageclient";

import * as gvp from "./GraphvizProvider";

export function activate(context: ExtensionContext) {
	const lc = createLanguageClient();
	const lcDisposable = lc.start();

	const gvProviders = createGraphvizProviders();

	context.subscriptions.push(lcDisposable, ...gvProviders);
}

function createLanguageClient() {
	// The debug options for the server
	// const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { command: "dot-language-server", args: ["--stdio"] },
		debug: { command: "dot-language-server", args: ["--stdio"] },
	};
	// { module: serverModule, transport: TransportKind.ipc, options: debugOptions },

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ language: "dot" }],
		synchronize: {
			configurationSection: "dotLanguageServer",
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
		}
	};

	return new LanguageClient(
		"dotLanguageServer",
		"DOT Language Server",
		serverOptions,
		clientOptions
	);
}

/**
 * Based on https://github.com/joaompinto/vscode-graphviz
 */
function createGraphvizProviders() {
	const provider = new gvp.GraphvizProvider();
	const providerRegistrations = Disposable.from(
		workspace.registerTextDocumentContentProvider(gvp.GraphvizProvider.scheme, provider)
	);

	// When the active document is changed set the provider for rebuild
	// this only occurs after an edit in a document
	workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
		if (e.document === window.activeTextEditor.document) {
			provider.setNeedsRebuild(true);
		}
	});

	// This occurs whenever the selected document changes, its useful to keep the
	window.onDidChangeTextEditorSelection((e: TextEditorSelectionChangeEvent) => {
		if (!!e && !!e.textEditor && (e.textEditor === window.activeTextEditor)) {
			provider.setNeedsRebuild(true);
		};
	})

	workspace.onDidSaveTextDocument((e: TextDocument) => {
		if (e === window.activeTextEditor.document) {
			provider.update(gvp.makePreviewUri(e));
		}
	});

	const previewToSide = commands.registerCommand("graphviz.previewToSide", () => {
		const displayColumn = getDisplayColumn(window.activeTextEditor.viewColumn);
		return gvp.createHTMLWindow(provider, displayColumn);
	});

	const preview = commands.registerCommand("graphviz.preview", () => {
		return gvp.createHTMLWindow(provider, window.activeTextEditor.viewColumn);
	});

	return [previewToSide, preview, providerRegistrations];
}

function getDisplayColumn(viewColumn: ViewColumn) {
	switch (viewColumn) {
		case ViewColumn.One:
			return ViewColumn.Two;
		case ViewColumn.Two:
		case ViewColumn.Three:
			return ViewColumn.Three;
	}
}
