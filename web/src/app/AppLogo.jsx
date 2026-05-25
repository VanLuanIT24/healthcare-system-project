const LOGO_SOURCES = {
  horizontal: '/brand/moh-logo-horizontal.svg?v=20260524-logo',
  stacked: '/brand/moh-logo-stacked.svg?v=20260524-logo',
  mark: '/brand/moh-mark.svg?v=20260524-logo',
  mono: '/brand/moh-logo-mono.svg?v=20260524-logo',
};

const LOGO_ALT = {
  horizontal: 'Bộ Y tế - Ministry of Health',
  stacked: 'Bộ Y tế - Ministry of Health',
  mark: 'Bộ Y tế',
  mono: 'Bộ Y tế - Ministry of Health',
};

export const APP_BRAND_NAME = 'Bộ Y tế';
export const APP_BRAND_SUBTITLE = 'Ministry of Health';

export function AppLogo({ variant = 'horizontal', className = '', alt, ...imageProps }) {
  const resolvedVariant = LOGO_SOURCES[variant] ? variant : 'horizontal';
  const classes = ['app-logo', `app-logo--${resolvedVariant}`, className].filter(Boolean).join(' ');

  return (
    <img
      {...imageProps}
      className={classes}
      src={LOGO_SOURCES[resolvedVariant]}
      alt={alt ?? LOGO_ALT[resolvedVariant]}
      draggable="false"
      decoding="async"
    />
  );
}
