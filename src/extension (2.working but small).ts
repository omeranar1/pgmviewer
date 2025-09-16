import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
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

class PgmEditorProvider implements vscode.CustomTextEditorProvider {

    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        // Dosyayı binary olarak oku
        const fileUri = document.uri;
        const fileData = await vscode.workspace.fs.readFile(fileUri);
        const pgmData = this.parseP5Pgm(fileData);

        webviewPanel.webview.html = this.getHtmlForWebview(pgmData);
    }

    private parseP5Pgm(data: Uint8Array) {
        const decoder = new TextDecoder("ascii");

        let headerLines: string[] = [];
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
            } else {
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

    private getHtmlForWebview(pgmData: { width: number, height: number, maxGray: number, pixels: Uint8Array }) {
        const { width, height, maxGray, pixels } = pgmData;

        const base64Pixels = Buffer.from(pixels).toString('base64');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                margin: 0;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                font-family: sans-serif;
                overflow: hidden;
                background-color: #1e1e1e;
            }
            .canvas-container {
                position: relative;
                overflow: hidden;
                border: 1px solid #444;
                background-color: #2d2d2d;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            canvas {
                display: block;
                cursor: grab;
            }
            canvas:active {
                cursor: grabbing;
            }
            .controls {
                position: absolute;
                top: 10px;
                right: 10px;
                display: flex;
                gap: 5px;
                z-index: 100;
            }
            button {
                padding: 8px 12px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background 0.2s ease;
            }
            button:hover {
                background: #0062a3;
            }
            button:active {
                background: #00508a;
            }
            .zoom-info {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            .status-bar {
                margin-top: 10px;
                color: #ccc;
                font-size: 12px;
            }
        </style>
        </head>
        <body>
            <div class="canvas-container" id="canvasContainer">
                <canvas id="canvas"></canvas>
                <div class="controls">
                    <button id="zoomIn" title="Zoom In (++)">+</button>
                    <button id="zoomOut" title="Zoom Out (-)">-</button>
                    <button id="reset" title="Reset View (R)">Reset</button>
                </div>
                <div class="zoom-info" id="zoomInfo">Zoom: 100%</div>
            </div>
            <div class="status-bar" id="statusBar">
                ${width} × ${height} pixels | Max gray: ${maxGray}
            </div>
            
            <script>
                const width = ${width};
                const height = ${height};
                const maxGray = ${maxGray};
                const base64Pixels = "${base64Pixels}";

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
                const container = document.getElementById('canvasContainer');
                const zoomInBtn = document.getElementById('zoomIn');
                const zoomOutBtn = document.getElementById('zoomOut');
                const resetBtn = document.getElementById('reset');
                const zoomInfo = document.getElementById('zoomInfo');

                // Zoom ve offset değişkenleri
                let scale = 1;
                let offsetX = 0;
                let offsetY = 0;
                let isDragging = false;
                let lastX = 0;
                let lastY = 0;

                // Canvas boyutunu ayarla
                canvas.width = width;
                canvas.height = height;

                // Container boyutunu ayarla
                const maxWidth = window.innerWidth - 100;
                const maxHeight = window.innerHeight - 100;
                const aspectRatio = width / height;
                
                let containerWidth = Math.min(width, maxWidth);
                let containerHeight = containerWidth / aspectRatio;
                
                if (containerHeight > maxHeight) {
                    containerHeight = maxHeight;
                    containerWidth = containerHeight * aspectRatio;
                }
                
                container.style.width = containerWidth + 'px';
                container.style.height = containerHeight + 'px';

                // Orijinal ImageData oluştur
                const imageData = ctx.createImageData(width, height);
                for (let i = 0; i < pixels.length; i++) {
                    const val = Math.floor((pixels[i] / maxGray) * 255);
                    imageData.data[i*4 + 0] = val;
                    imageData.data[i*4 + 1] = val;
                    imageData.data[i*4 + 2] = val;
                    imageData.data[i*4 + 3] = 255;
                }

                // Önceden çizilmiş bir image oluştur
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(imageData, 0, 0);
                const image = new Image();
                image.src = tempCanvas.toDataURL();

                function draw() {
                    // Canvas temizle
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Transform uygula
                    ctx.save();
                    ctx.translate(offsetX, offsetY);
                    ctx.scale(scale, scale);
                    
                    // Görüntüyü çiz
                    ctx.drawImage(image, 0, 0);
                    
                    ctx.restore();
                }

                function updateZoomInfo() {
                    zoomInfo.textContent = 'Zoom: ' + Math.round(scale * 100) + '%';
                }

                function zoom(factor, centerX, centerY) {
                    const oldScale = scale;
                    scale = Math.max(0.1, Math.min(10, scale * factor));
                    
                    if (centerX !== undefined && centerY !== undefined) {
                        const rect = container.getBoundingClientRect();
                        const relativeX = (centerX - rect.left - offsetX) / oldScale;
                        const relativeY = (centerY - rect.top - offsetY) / oldScale;
                        
                        offsetX = centerX - rect.left - relativeX * scale;
                        offsetY = centerY - rect.top - relativeY * scale;
                    }
                    
                    draw();
                    updateZoomInfo();
                }

                function resetView() {
                    scale = 1;
                    offsetX = (container.clientWidth - width * scale) / 2;
                    offsetY = (container.clientHeight - height * scale) / 2;
                    draw();
                    updateZoomInfo();
                }

                // Mouse events for panning
                canvas.addEventListener('mousedown', (e) => {
                    if (e.button === 0) {
                        isDragging = true;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        canvas.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        const deltaX = e.clientX - lastX;
                        const deltaY = e.clientY - lastY;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        
                        offsetX += deltaX;
                        offsetY += deltaY;
                        
                        draw();
                        e.preventDefault();
                    }
                });

                document.addEventListener('mouseup', () => {
                    if (isDragging) {
                        isDragging = false;
                        canvas.style.cursor = 'grab';
                    }
                });

                // Mouse wheel for zooming
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const factor = e.deltaY < 0 ? 1.2 : 0.8;
                    zoom(factor, e.clientX, e.clientY);
                });

                // Touch events
                canvas.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 1) {
                        isDragging = true;
                        lastX = e.touches[0].clientX;
                        lastY = e.touches[0].clientY;
                        e.preventDefault();
                    } else if (e.touches.length === 2) {
                        // Pinch zoom için
                        e.preventDefault();
                    }
                });

                canvas.addEventListener('touchmove', (e) => {
                    if (isDragging && e.touches.length === 1) {
                        const deltaX = e.touches[0].clientX - lastX;
                        const deltaY = e.touches[0].clientY - lastY;
                        lastX = e.touches[0].clientX;
                        lastY = e.touches[0].clientY;
                        
                        offsetX += deltaX;
                        offsetY += deltaY;
                        
                        draw();
                        e.preventDefault();
                    }
                });

                canvas.addEventListener('touchend', () => {
                    isDragging = false;
                });

                // Button events
                zoomInBtn.addEventListener('click', () => {
                    const rect = container.getBoundingClientRect();
                    zoom(1.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
                });

                zoomOutBtn.addEventListener('click', () => {
                    const rect = container.getBoundingClientRect();
                    zoom(0.67, rect.left + rect.width / 2, rect.top + rect.height / 2);
                });

                resetBtn.addEventListener('click', resetView);

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'r' || e.key === 'R') {
                        resetView();
                        e.preventDefault();
                    } else if (e.key === '+' || e.key === '=') {
                        const rect = container.getBoundingClientRect();
                        zoom(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
                        e.preventDefault();
                    } else if (e.key === '-' || e.key === '_') {
                        const rect = container.getBoundingClientRect();
                        zoom(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
                        e.preventDefault();
                    }
                });

                // Resize handling
                window.addEventListener('resize', () => {
                    // Container boyutunu yeniden hesapla
                    const maxWidth = window.innerWidth - 100;
                    const maxHeight = window.innerHeight - 100;
                    const aspectRatio = width / height;
                    
                    let containerWidth = Math.min(width, maxWidth);
                    let containerHeight = containerWidth / aspectRatio;
                    
                    if (containerHeight > maxHeight) {
                        containerHeight = maxHeight;
                        containerWidth = containerHeight * aspectRatio;
                    }
                    
                    container.style.width = containerWidth + 'px';
                    container.style.height = containerHeight + 'px';
                    
                    draw();
                });

                // Image yüklendikten sonra çiz
                image.onload = () => {
                    resetView();
                };

            </script>
        </body>
        </html>
    `;
    }
}