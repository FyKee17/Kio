export const FONT = '"Pixelify Sans", monospace';

// Espera a fonte carregar (no máximo 2s) para os textos não nascerem com a fonte reserva.
export function waitForFont() {
  if (!document.fonts?.load) return Promise.resolve();
  const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
  return Promise.race([
    Promise.all([document.fonts.load('22px "Pixelify Sans"'), document.fonts.load('bold 22px "Pixelify Sans"')]),
    timeout,
  ]).catch(() => {});
}
