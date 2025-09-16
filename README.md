test2test# PGM Viewer for VSCode

A custom editor extension for Visual Studio Code that renders `.pgm` files in **P5 (binary)** Portable Graymap format.

---

## Features

- **P5 PGM (binary) format support:** Opens and displays only P5 type PGM files.
- **Real-time rendering:** Efficiently renders image data in a webview panel.
- **Zoom & Pan:** Use mouse wheel to zoom and drag to pan the image.
- **Control buttons:** Zoom in, zoom out, and reset view buttons for easy interaction.
- **Pixel information tooltip:** Shows grayscale value of the pixel under the cursor.
- **Keyboard shortcuts:**
  - `R`: Reset the view
  - `+ / =`: Zoom in
  - `- / _`: Zoom out
- **High-quality rendering:** Pixels are drawn on canvas with smoothing disabled to avoid blur.

---

## How to Use

1. Open a `.pgm` file (P5 format) in VSCode.
2. The file will automatically open in the custom PGM viewer editor.
3. Zoom in/out using mouse wheel or the `+` / `-` buttons.
4. Click and drag the image to pan.
5. Reset the view using the `Reset` button or pressing `R`.
6. Hover over the image to see pixel grayscale values.

---

## Supported Format

- PGM P5 (Binary Portable Graymap) only.
- Expected header format:
P5
<width> <height>
<maxGrayValue>
[binary pixel data]

---

## Installation

- Install from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/) (if published).
- Or build and load the extension locally in VSCode.
- Open any supported `.pgm` file to use the viewer.

---

## Development

This extension leverages VSCode’s `CustomTextEditorProvider` API to read binary PGM data and render it on an HTML5 canvas inside a webview panel.

The code is well-commented for easy understanding and customization.

---

## License

MIT License. Feel free to use, modify, and share!

---

## Screenshot

![PGM Viewer Screenshot](screenshot.png)  
*Example of PGM Viewer rendering a grayscale image.*

---

### Contributions and feedback are welcome!
