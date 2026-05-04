import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("textMate3.helloWorld", () => {
      const greeting = vscode.workspace
        .getConfiguration("textMate3")
        .get<string>("greeting", "Hello");
      void vscode.window.showInformationMessage(`${greeting} from TextMate3!`);
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "markdown" },
      {
        provideHover() {
          return new vscode.Hover(
            new vscode.MarkdownString(
              "**TextMate3** hover stub — replace me with a real provider.",
            ),
          );
        },
      },
    ),
  );
}

export function deactivate(): void {}
