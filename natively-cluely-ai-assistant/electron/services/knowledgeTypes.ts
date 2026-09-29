export const DocType = {
  RESUME: 'resume',
  JD: 'jd',
} as const;

export type DocTypeValue = (typeof DocType)[keyof typeof DocType];
