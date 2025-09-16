import * as vscode from 'vscode';
import sharp from 'sharp';

export function activate(context: vscode.ExtensionContext)
{
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'pgmviewer.pgmEditor',
			new PgmEditorProvider(context),
			{
				supportsMultipleEditorsPerDocument: false
			}
		)
	);
}

class PgmEditorProvider implements vscode.CustomTextEditorProvider
{

	constructor(private readonly context: vscode.ExtensionContext) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void>
	{
		webviewPanel.webview.options = {
			enableScripts: true,
		};

		// Dosyayı binary olarak oku
		const fileUri = document.uri;
		const fileData = await vscode.workspace.fs.readFile(fileUri);
		const pgmData = this.parseP5Pgm(fileData);
		const base64Png = await this.convertPgmToBase64Png(pgmData);
		webviewPanel.webview.html = this.getHtmlForWebview(base64Png, pgmData);

	}

	private async convertPgmToBase64Png(pgmData: { width: number, height: number, maxGray: number, pixels: Uint8Array }): Promise<string>
	{
		const { width, height, pixels } = pgmData;

		// Sharp ile raw veriyi PNG'ye dönüştür
		const pngBuffer = await sharp(pixels, {
			raw: {
				width,
				height,
				channels: 1
			}
		}).png().toBuffer();

		return pngBuffer.toString('base64');
	}

	private parseP5Pgm(data: Uint8Array)
	{
		const decoder = new TextDecoder("ascii");

		let headerLines: string[] = [];
		let headerEndIndex = 0;
		let currentLine = '';

		for (let i = 0; i < data.length; i++)
		{
			const char = String.fromCharCode(data[i]);
			if (char === '\n')
			{
				const trimmedLine = currentLine.trim();
				if (trimmedLine.length > 0 && !trimmedLine.startsWith('#'))
				{
					headerLines.push(trimmedLine);
				}

				if (headerLines.length === 3)
				{
					headerEndIndex = i + 1; // \n dahil
					break;
				}

				currentLine = '';
			} else
			{
				currentLine += char;
			}
		}

		if (headerLines[0] !== 'P5')
		{
			throw new Error('Sadece P5 PGM formatı destekleniyor');
		}

		const [width, height] = headerLines[1].split(/\s+/).map(Number);
		const maxGray = Number(headerLines[2]);

		const pixels = data.slice(headerEndIndex);

		if (pixels.length < width * height)
		{
			console.warn(`Uyarı: Beklenen piksel sayısı ${width * height}, ancak yalnızca ${pixels.length} byte veri var.`);
		}

		return {
			width,
			height,
			maxGray,
			pixels
		};
	}


	private getHtmlForWebview(base64Png: string, pgmData: { width: number, height: number, maxGray: number, pixels: Uint8Array })
	{
		const { width, height } = pgmData;

		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<style>
				body {
					margin: 0;
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100vh;
					background-color: #f0f0f0;
				}
				img {
					border: 1px solid black;
					max-width: 100%;
					max-height: 100%;
				}
			</style>
		</head>
		<body>
			<img src="data:image/png;base64,${base64Png}" width="${width}" height="${height}" />
		</body>
		</html>
	`;
	}


}
