import * as vscode from 'vscode';

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

		webviewPanel.webview.html = this.getHtmlForWebview(pgmData);
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

	private getHtmlForWebview(pgmData: { width: number, height: number, maxGray: number, pixels: Uint8Array })
	{
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
                flex-direction: column;
                font-family: sans-serif;
                overflow: hidden;
                // background-color: #ff31d6ff;
            }
            .canvas-container {
                flex: 1;
                position: relative;
                overflow: hidden;
                // background-color: #e1f21eff;
            }
            .canvas-selam {
                flex: 1;
                position: relative;
                overflow: hidden;
                // background-color: #f533ffff;
            }
            canvas {
                display: block;
                // cursor: grab;
            }
            canvas:active {
                cursor: grabbing;
            }
            .controls {
                position: absolute;
                top: 10px;
                right: 30px;
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
                font-size: 16px;
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
                font-size: 14px;
                font-weight: 500;
            }
            .status-bar {
                padding: 8px 12px;
                color: #ccc;
                font-size: 14px;
                background-color: #252526;
                border-top: 1px solid #444;
            }
            .tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 13px;
                pointer-events: none;
                z-index: 1000;
                display: none;
            }
        </style>
        </head>
        <body>
            <div class="canvas-container" id="canvasContainer">
                <canvas class="canvas-selam" id="canvas"></canvas>
                <div class="controls">
                    <button id="zoomIn" title="Zoom In (++)">+</button>
                    <button id="zoomOut" title="Zoom Out (-)">-</button>
                    <button id="reset" title="Reset View (R)">Reset</button>
                </div>
                <div class="zoom-info" id="zoomInfo">Zoom: 100%</div>
                <div class="tooltip" id="pixelInfo"></div>
            </div>
            <div class="status-bar" id="statusBar">
                ${width} × ${height} pixels | Max gray: ${maxGray} | Use mouse wheel to zoom, drag to pan
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
                const pixelInfo = document.getElementById('pixelInfo');

                // Zoom ve offset değişkenleri
                let scale = 1;
                let offsetX = 0;
                let offsetY = 0;
                let isDragging = false;
                let lastX = 0;
                let lastY = 0;

                // Canvas boyutunu orijinal resim boyutunda ayarla
                // canvas.width = width;
                // canvas.height = height;

				canvas.width = container.clientWidth;
        		canvas.height = container.clientHeight;

                // Container boyutlandırma - basit versiyon
                function resizeContainer() {
                    const containerWidth = window.innerWidth - 20;
                    const containerHeight = window.innerHeight - 40;
                    
                    container.style.width = containerWidth + 'px';
                    container.style.height = containerHeight + 'px';
                    
                    resetView();
                }

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
					ctx.imageSmoothingEnabled = false; // 💥 Blur'u engelleyen ayar
                    ctx.drawImage(image, 0, 0);
                    
                    ctx.restore();
                }

                function updateZoomInfo() {
                    zoomInfo.textContent = 'Zoom: ' + Math.round(scale * 100) + '%';
                }

                function getPixelValue(x, y) {
                    const rect = container.getBoundingClientRect();
                    const relativeX = (x - rect.left - offsetX) / scale;
                    const relativeY = (y - rect.top - offsetY) / scale;
                    
                    if (relativeX >= 0 && relativeX < width && relativeY >= 0 && relativeY < height) {
                        const pixelIndex = Math.floor(relativeY) * width + Math.floor(relativeX);
                        if (pixelIndex >= 0 && pixelIndex < pixels.length) {
                            return pixels[pixelIndex];
                        }
                    }
                    return null;
                }

                function showPixelInfo(x, y, value) {
                    pixelInfo.style.display = 'block';
                    pixelInfo.style.left = (x + 10) + 'px';
                    pixelInfo.style.top = (y + 10) + 'px';
                    pixelInfo.textContent = \`Value: \${value}/\${maxGray}\`;
                }

                function hidePixelInfo() {
                    pixelInfo.style.display = 'none';
                }

                function zoom(factor, centerX, centerY) {
                    const oldScale = scale;
                    scale = Math.max(0.1, Math.min(20, scale * factor));
                    
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
                    offsetX = 0;
                    offsetY = 0;
                    
                    // Sadece küçük resimleri ortala, büyükler olduğu gibi kalsın
                    // if (width < container.clientWidth && height < container.clientHeight) 
					{
                        offsetX = (container.clientWidth - width) / 2;
                        offsetY = (container.clientHeight - height) / 2;
                    }
                    
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
                    
                    // Pixel bilgisi göster
                    const pixelValue = getPixelValue(e.clientX, e.clientY);
                    if (pixelValue !== null) {
                        showPixelInfo(e.clientX, e.clientY, pixelValue);
                    } else {
                        hidePixelInfo();
                    }
                });

                document.addEventListener('mouseup', () => {
                    if (isDragging) {
                        isDragging = false;
                        canvas.style.cursor = 'grab';
                    }
                });

                canvas.addEventListener('mouseleave', () => {
                    hidePixelInfo();
                });

                // Mouse wheel for zooming
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const factor = e.deltaY < 0 ? 1.2 : 0.8;
                    zoom(factor, e.clientX, e.clientY);
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
                window.addEventListener('resize', resizeContainer);

                // Image yüklendikten sonra çiz
                image.onload = () => {
                    resizeContainer();
                    draw();
                };

                // Initial setup
                resizeContainer();

            </script>
        </body>
        </html>
    `;
	}
}