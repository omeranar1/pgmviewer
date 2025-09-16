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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
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
        webviewPanel.webview.html = this.getHtmlForWebview(pgmData);
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
    getHtmlForWebview(pgmData) {
        const { width, height, maxGray, pixels } = pgmData;
        // Binary veriyi base64’e çevirelim, JSON’da göndermek için
        const base64Pixels = Buffer.from(pixels).toString('base64');
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
			<meta charset="UTF-8">
			<style>
                body {
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-direction: column;
                    font-family: sans-serif;
                }
                canvas {
                    border: 1px solid black;
                }
            </style>
			</head>
            <body>
                <canvas id="canvas" width="${width}" height="${height}" style="border:1px solid black"></canvas>
                <script>
                    const width = ${width};
                    const height = ${height};
                    const maxGray = ${maxGray};
                    const base64Pixels = "${base64Pixels}";

                    // Base64’den Uint8Array’a dönüştür
                    function base64ToUint8Array(base64) {
                        const raw = atob(base64);
                        const array = new Uint8Array(raw.length);
                        for (let i = 0; i < raw.length; i++) {
                            array[i] = raw.charCodeAt(i);
                        }
                        return array;
                    }

                    const pixels = base64ToUint8Array(base64Pixels);

                    const canvas = document.getElementById('canvas');
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.createImageData(width, height);

                    for (let i = 0; i < pixels.length; i++) {
                        const val = Math.floor((pixels[i] / maxGray) * 255);
                        imageData.data[i*4 + 0] = val;
                        imageData.data[i*4 + 1] = val;
                        imageData.data[i*4 + 2] = val;
                        imageData.data[i*4 + 3] = 255;
                    }

                    ctx.putImageData(imageData, 0, 0);
                </script>
            </body>
            </html>
        `;
    }
}
//# sourceMappingURL=extension%20copy.js.map