import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_PAGES = 64;
export function supportsWorkPreview(file: File) {
  return /\.(pdf|png|jpe?g)$/i.test(file.name);
}
function canvasFor(width: number, height: number) {
  const scale = Math.min(1100 / width, 1600 / height, 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Preglednik ne može pripremiti pregled rada.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context, scale };
}
async function rasterFile(canvas: HTMLCanvasElement, name: string) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.max(18, Math.round(canvas.width / 25))}px sans-serif`;
  ctx.fillStyle = 'rgba(45, 64, 128, 0.23)';
  for (let y = -canvas.height; y < canvas.height; y += Math.max(100, canvas.height / 4))
    ctx.fillText('FormaPoint · PREGLED RADA', 0, y);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
  ctx.fillStyle = '#263769';
  ctx.textAlign = 'center';
  ctx.font = '14px sans-serif';
  ctx.fillText(
    'PREGLED · Završna datoteka dostupna je nakon potvrde cijele uplate',
    canvas.width / 2,
    canvas.height - 12,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Priprema pregleda nije uspjela.'))),
      'image/jpeg',
      0.8,
    ),
  );
  canvas.width = canvas.height = 1;
  return new File([blob], name, { type: 'image/jpeg' });
}
export async function* createWorkPreviews(source: File): AsyncGenerator<File> {
  if (source.size > 20 * 1024 * 1024)
    throw new Error('Datoteka za pregled smije imati najviše 20 MB.');
  if (/\.pdf$/i.test(source.name)) {
    const task = getDocument({
      data: new Uint8Array(await source.arrayBuffer()),
      cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
      wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
      iccUrl: `${import.meta.env.BASE_URL}pdfjs/iccs/`,
      enableXfa: false,
      disableFontFace: true,
    });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > MAX_PAGES)
        throw new Error(
          `PDF za pregled smije imati najviše ${MAX_PAGES} stranice. Podijelite dulji rad u više PDF datoteka.`,
        );
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const size = page.getViewport({ scale: 1 });
        const { canvas, context, scale } = canvasFor(size.width, size.height);
        await page.render({
          canvas,
          canvasContext: context,
          viewport: page.getViewport({ scale }),
          background: '#fff',
        }).promise;
        yield await rasterFile(
          canvas,
          `Pregled - ${source.name.replace(/\.pdf$/i, '').slice(0, 85)} - ${number}.jpg`,
        );
        page.cleanup();
      }
    } finally {
      await pdf.destroy();
    }
  } else if (/\.(png|jpe?g)$/i.test(source.name)) {
    const image = await createImageBitmap(source);
    try {
      const { canvas, context } = canvasFor(image.width, image.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      yield await rasterFile(
        canvas,
        `Pregled - ${source.name.replace(/\.[^.]+$/, '').slice(0, 100)}.jpg`,
      );
    } finally {
      image.close();
    }
  } else throw new Error('Za pregled priložite PDF, PNG ili JPG.');
}
