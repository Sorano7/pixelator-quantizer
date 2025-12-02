import { processImage } from "./core";

self.onmessage = (event: MessageEvent) => {
  const {
    width, height, data,
    doPixelate, blockSize, doQuantize, paletteSize
  } = event.data as {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    doPixelate: boolean;
    blockSize: number;
    doQuantize: boolean;
    paletteSize: number;
  };

  const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
  const processed = processImage(imageData, doPixelate, blockSize, doQuantize, paletteSize);

  (self as unknown as DedicatedWorkerGlobalScope).postMessage(
    {
      width: processed.width,
      height: processed.height,
      buffer: processed.data.buffer,
    }
  );
};