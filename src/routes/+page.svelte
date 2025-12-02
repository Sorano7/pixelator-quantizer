<script lang="ts">
  import { onMount } from "svelte";

  const MAX_SIZE = 4000;

  let images: FileList | null = $state(null);

  let originalCanvas: OffscreenCanvas | null = null;
  let outputCanvas: HTMLCanvasElement | null = $state(null);

  let doPixelate: boolean = $state(true);
  let blockSize: number = $state(16);

  let doQuantize: boolean = $state(true);
  let paletteSize: number = $state(16);

  let image: ImageData;

  let processTimeout: number | null = null;
  let isProcessing = false;
  let pendingRun = false;

  let worker: Worker | null = null;

  onMount(() => {
    if (typeof OffscreenCanvas !== 'undefined') {
      originalCanvas = new OffscreenCanvas(MAX_SIZE, MAX_SIZE);
    }

    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL("$lib/image-worker.ts", import.meta.url), { type: "module" });

      worker.onmessage = (event: MessageEvent) => {
        const { width, height, buffer } = event.data as {
          width: number;
          height: number;
          buffer: ArrayBuffer;
        };

        const ctx = outputCanvas?.getContext('2d');
        if (!ctx || !outputCanvas) return;

        const data = new Uint8ClampedArray(buffer);
        const imageData = new ImageData(data, width, height);
        ctx.putImageData(imageData, 0, 0);
      }
    }
  })

  $effect(() => {
    if (!images) return;

    const file = images[0];
    if (!file) return;

    console.log(`Loaded file: ${file.name}`)

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = () => {
      console.log(`Loaded image size: ${img.width} x ${img.height}`)

      try {
        drawOriginal(img);
        processAndRender();
      } catch (e) {
        console.error(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      console.error("Could not load image file.")
      URL.revokeObjectURL(url);
    }
  })

  $effect(() => {
    doPixelate; blockSize; doQuantize; paletteSize; image;
    if (!image) return;

    if (processTimeout !== null) clearTimeout(processTimeout);

    processTimeout = window.setTimeout(() => {
      processAndRender();
    }, 150)
    
  })

  function drawOriginal(img: HTMLImageElement): void {
    if (!originalCanvas || !outputCanvas) return;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;

    let scale = 1;

    const pixelScale = MAX_SIZE / Math.max(imgW, imgH);
    scale = Math.min(scale, pixelScale, 1);

    const container = outputCanvas.parentElement as HTMLElement | null;
    if (container) {
      const rect = container.getBoundingClientRect();
      const maxW = rect.width;
      const maxH = rect.height;

      if (maxW > 0 && maxH > 0) {
        const containerScale = Math.min(maxW / imgW, maxH / imgH);
        scale = Math.min(scale, containerScale, 1);
      }
    }

    const width = Math.round(imgW * scale);
    const height = Math.round(imgH * scale);

    const ctx = originalCanvas.getContext('2d')
    if (!ctx) return;

    originalCanvas.width = width;
    originalCanvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    image = ctx.getImageData(0, 0, width, height);

    const outCtx = outputCanvas.getContext('2d');
    if (!outCtx) return;

    outputCanvas.width = width;
    outputCanvas.height = height;
    outCtx.clearRect(0, 0, width, height);
  }

  function processAndRender(): void {
    if (!worker || !image) return;

    if (isProcessing) {
      pendingRun = true;
      return;
    }

    isProcessing = true;

    try {
      const { width, height, data } = image;

      worker.postMessage(
        { width, height, data, doPixelate, blockSize, doQuantize, paletteSize }
      );
    } catch (e) {
      console.error(e);
    } finally {
      isProcessing = false;
      if (pendingRun) {
        pendingRun = false;
        processAndRender();
      }
    }
  
  }
</script>

<div class="app">
  <div class="canvas-shell">
    <div class="canvas-inner">
      <canvas bind:this={outputCanvas}></canvas>
    </div>
  </div>

  <aside class="panel">
    <header class="panel-header">
      <h1>Pixelator + Quantizer</h1>
      <p>Upload an image and tweak the effect.</p>
    </header>

    <div class="panel-body">
      <div class="control-group">
        <label for="file">Image</label>
        <div class="file-input">
          <input
            id="file"
            type="file"
            accept="image/*"
            bind:files={images}
          />
        </div>
      </div>

      <div class="control-row">
        <div class="control-toggle">
          <label for="pixelate">
            <span>Pixelate</span>
            <input
              id="pixelate"
              type="checkbox"
              bind:checked={doPixelate}
            />
          </label>
        </div>

        <div class="control-slider">
          <label for="block">
            <span>Block size</span>
            <input
              id="block"
              type="range"
              min="2"
              max="64"
              step="1"
              bind:value={blockSize}
            />
          </label>
        </div>
      </div>

      <div class="control-row">
        <div class="control-toggle">
          <label for="quantize">
            <span>Quantize</span>
            <input
              id="quantize"
              type="checkbox"
              bind:checked={doQuantize}
            />
          </label>
        </div>

        <div class="control-slider">
          <label for="palette">
            <span>Palette size</span>
            <input
              id="palette"
              type="range"
              min="2"
              max="64"
              step="1"
              bind:value={paletteSize}
            />
          </label>
        </div>
      </div>
    </div>
  </aside>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
      "Segoe UI", sans-serif;
    background: #f4f4f5;
    color: #111827;
  }

  .app {
    display: grid;
    grid-template-columns: minmax(0, 2.4fr) minmax(280px, 1fr);
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
    background: radial-gradient(circle at top left, #ffffff 0, #eff1f5 40%, #e4e5e9 100%);
  }

  .canvas-shell {
    padding: 1.5rem;
    display: flex;
    align-items: stretch;
    justify-content: center;
  }

  .canvas-inner {
    flex: 1;
    border-radius: 1.25rem;
    background: #ffffff;
    box-shadow:
      0 18px 55px rgba(15, 23, 42, 0.16),
      0 0 0 1px rgba(148, 163, 184, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .canvas-inner::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: linear-gradient(45deg, #f3f4f6 25%, transparent 25%),
      linear-gradient(-45deg, #f3f4f6 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f3f4f6 75%),
      linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
    background-size: 18px 18px;
    background-position:
      0 0,
      0 9px,
      9px -9px,
      -9px 0;
    opacity: 0.7;
    pointer-events: none;
  }

  .canvas-inner canvas {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
    position: relative;
    z-index: 1;
  }

  .panel {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(16px);
    border-left: 1px solid rgba(148, 163, 184, 0.2);
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
  }

  .panel-header h1 {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    margin: 0 0 0.25rem;
  }

  .panel-header p {
    margin: 0;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .panel-body {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .control-group label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
  }

  .file-input input[type="file"] {
    font-size: 0.85rem;
    border-radius: 0.7rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.8);
    background: #f9fafb;
    width: 100%;
    cursor: pointer;
  }

  .file-input input[type="file"]::-webkit-file-upload-button {
    border: 0;
    border-radius: 0.55rem;
    padding: 0.35rem 0.9rem;
    margin-right: 0.75rem;
    background: #111827;
    color: #f9fafb;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .control-row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.9fr);
    gap: 0.75rem;
    align-items: center;
  }

  .control-toggle label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: #f9fafb;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .control-toggle span {
    font-weight: 500;
  }

  .control-toggle input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: #111827;
    cursor: pointer;
  }

  .control-slider label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
  }

  .control-slider input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 0.3rem;
    border-radius: 999px;
    background: #e5e7eb;
    outline: none;
    cursor: pointer;
  }

  .control-slider input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: #111827;
    box-shadow: 0 0 0 2px #ffffff;
    margin-top: -0.33rem;
  }

  .control-slider input[type="range"]::-moz-range-thumb {
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: #111827;
    border: 2px solid #ffffff;
  }

  .control-slider input[type="range"]::-moz-range-track {
    height: 0.3rem;
    border-radius: 999px;
    background: #e5e7eb;
  }

  @media (max-width: 900px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 2.2fr) auto;
      height: 100vh;
    }

    .panel {
      border-left: none;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }

    .canvas-shell {
      padding: 1rem;
    }
  }
</style>
