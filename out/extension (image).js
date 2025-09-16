"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const sharp_1 = __importDefault(require("sharp"));
function activate(context) {
    context.subscriptions.push(vscode.window.registerCustomEditorProvider('pgmviewer.pgmEditor', new PgmEditorProvider(context), {
        supportsMultipleEditorsPerDocument: false
    }));
}
class PgmEditorProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    async resolveCustomTextEditor(document, webviewPanel, _token) {
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
    async convertPgmToBase64Png(pgmData) {
        const { width, height, pixels } = pgmData;
        // Sharp ile raw veriyi PNG'ye dönüştür
        const pngBuffer = await (0, sharp_1.default)(pixels, {
            raw: {
                width,
                height,
                channels: 1
            }
        }).png().toBuffer();
        return pngBuffer.toString('base64');
    }
    parseP5Pgm(data) {
        const decoder = new TextDecoder("ascii");
        let headerLines = [];
        let headerEndIndex = 0;
        let currentLine = '';
        for (let i = 0; i < data.length; i++) {
            const char = String.fromCharCode(data[i]);
            if (char === '\n') {
                const trimmedLine = currentLine.trim();
                if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
                    headerLines.push(trimmedLine);
                }
                if (headerLines.length === 3) {
                    headerEndIndex = i + 1; // \n dahil
                    break;
                }
                currentLine = '';
            }
            else {
                currentLine += char;
            }
        }
        if (headerLines[0] !== 'P5') {
            throw new Error('Sadece P5 PGM formatı destekleniyor');
        }
        const [width, height] = headerLines[1].split(/\s+/).map(Number);
        const maxGray = Number(headerLines[2]);
        const pixels = data.slice(headerEndIndex);
        if (pixels.length < width * height) {
            console.warn(`Uyarı: Beklenen piksel sayısı ${width * height}, ancak yalnızca ${pixels.length} byte veri var.`);
        }
        return {
            width,
            height,
            maxGray,
            pixels
        };
    }
    getHtmlForWebview(base64Png, pgmData) {
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
//# sourceMappingURL=extension%20(image).js.map