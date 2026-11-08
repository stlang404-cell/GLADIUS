/** Original Roman icon set (24×24, stroke-based so it scales crisply). */
type P = { size?: number; className?: string };
const S = ({ size = 24, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={'ico ' + (className ?? '')} aria-hidden>
    {children}
  </svg>
);

export const IconArena = (p: P) => (
  <S {...p}>
    <path d="M5 19 17.5 6.5M17.5 6.5 19 3l-3.5 1.5M5 19l-1.5.5.5-1.5M7.5 16.5l-2-2" />
    <path d="M19 19 6.5 6.5M6.5 6.5 5 3l3.5 1.5M19 19l1.5.5-.5-1.5M16.5 16.5l2-2" />
  </S>
);
export const IconEmpire = (p: P) => (
  <S {...p}>
    <path d="M3 9.5 12 4l9 5.5H3Z" />
    <path d="M5 10v7M9 10v7M15 10v7M19 10v7M3.5 20h17M4.5 17.5h15" />
  </S>
);
export const IconAcademy = (p: P) => (
  <S {...p}>
    <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7" />
    <path d="M6 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2ZM7 20a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2Z" />
    <path d="M10 9h6M10 12h6M10 15h4" />
  </S>
);
export const IconSpectate = (p: P) => (
  <S {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.2" />
  </S>
);
export const IconLegacy = (p: P) => (
  <S {...p}>
    <path d="M12 5c-1.5 1-2 2.6-2 4h4c0-1.4-.5-3-2-4Z" />
    <path d="M10 9 3 7.5c.8 2.8 3 4.6 6 5M14 9l7-1.5c-.8 2.8-3 4.6-6 5" />
    <path d="M9 12.5c.3 2.5 1.3 4.3 3 5.5 1.7-1.2 2.7-3 3-5.5M10 20h4M12 18v2" />
  </S>
);
export const IconCrown = (p: P) => (
  <S {...p}>
    <path d="M4 17 3 8l5 4 4-6 4 6 5-4-1 9H4Z" />
    <path d="M4 20h16" />
  </S>
);
export const IconTrophy = (p: P) => (
  <S {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5" />
  </S>
);
export const IconLaurel = (p: P) => (
  <S {...p}>
    <path d="M8 20c-3-2-4.5-5-4.5-8.5S5 5 7 3.5M16 20c3-2 4.5-5 4.5-8.5S19 5 17 3.5" />
    <path d="M4 9.5c1.5.3 2.6 1 3 2.3M3.8 13.5c1.6 0 2.8.6 3.5 1.8M5.5 6c1.4.6 2.2 1.6 2.3 2.9M20 9.5c-1.5.3-2.6 1-3 2.3M20.2 13.5c-1.6 0-2.8.6-3.5 1.8M18.5 6c-1.4.6-2.2 1.6-2.3 2.9" />
  </S>
);
export const IconFlag = (p: P) => (
  <S {...p}>
    <path d="M5 21V4M5 4h12l-2 4 2 4H5" />
  </S>
);
export const IconHalf = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" stroke="none" />
  </S>
);
export const IconUndo = (p: P) => (
  <S {...p}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h9a5 5 0 0 1 0 10h-2" />
  </S>
);
export const IconRotate = (p: P) => (
  <S {...p}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" />
  </S>
);
export const IconPause = (p: P) => (
  <S {...p}>
    <path d="M9 6v12M15 6v12" />
  </S>
);
export const IconPlay = (p: P) => (
  <S {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" />
  </S>
);
export const IconRefresh = (p: P) => (
  <S {...p}>
    <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.6 5.7L4 15.5M4 20v-4.5h4.5" />
  </S>
);
export const IconShield = (p: P) => (
  <S {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z" />
  </S>
);
export const IconClose = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IconStar = (p: P) => (
  <S {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
  </S>
);
export const IconChevron = (p: P) => (
  <S {...p}>
    <path d="m9 5 7 7-7 7" />
  </S>
);
