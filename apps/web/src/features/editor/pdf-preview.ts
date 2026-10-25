import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PREVIEW_DIMENSION = 2400;

export async function countPdfPages(file: Blob): Promise<number> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  const pdf = await task.promise;

  try {
    return pdf.numPages;
  } finally {
    await task.destroy();
  }
}

export async function renderPdfPageToPng(
  file: Blob,
  pageNumber: number,
): Promise<Blob> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  const pdf = await task.promise;

  try {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`PDF page ${pageNumber} does not exist`);
    }

    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2.5,
      MAX_PREVIEW_DIMENSION /
        Math.max(baseViewport.width, baseViewport.height),
    );
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not supported by this browser');
    }

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Unable to encode the PDF preview'));
        }
      }, 'image/png');
    });
  } finally {
    await task.destroy();
  }
}
