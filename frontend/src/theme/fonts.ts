// Manrope font family constants, loaded once in App.tsx via @expo-google-fonts/manrope.
// Custom fonts loaded this way are static per-weight files, not variable fonts, so a
// screen's existing `fontWeight: 'XXX'` needs a matching `fontFamily` set alongside it
// (or in place of it) rather than relying on the OS to synthesize bold from one file.

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Maps an existing RN fontWeight value to the matching pre-weighted Manrope file.
export const fontFamilyForWeight = (weight?: string | number): string => {
  const w = String(weight ?? '400');
  if (w === '800' || w === '900') return fonts.extrabold;
  if (w === '700' || w === 'bold') return fonts.bold;
  if (w === '600') return fonts.semibold;
  if (w === '500' || w === '500') return fonts.medium;
  return fonts.regular;
};
