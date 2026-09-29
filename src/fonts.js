export const TITLE_FONT = '"Cinzel", Georgia, serif';
export const BODY_FONT = '"Nunito", "Segoe UI", sans-serif';

// Espera as fontes carregarem (no máximo 2,5s) para os textos não nascerem com a fonte reserva.
export function waitForFont() {
  if (!document.fonts?.load) return Promise.resolve();
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([
    Promise.all([
      document.fonts.load('700 32px "Cinzel"'),
      document.fonts.load('500 32px "Cinzel"'),
      document.fonts.load('italic 400 22px "Nunito"'),
      document.fonts.load('400 22px "Nunito"'),
      document.fonts.load('700 22px "Nunito"'),
    ]),
    timeout,
  ]).catch(() => {});
}
