export const specialtySources = {
  twoWheeled: {
    title: 'דו־גלגלי',
    fields: ['tozeret_nm', 'degem_nm', 'sug_rechev_EU_cd'],
  },
  heavy: {
    title: 'רכב כבד וחסר קוד דגם',
    fields: ['tozeret_nm', 'degem_nm', 'tkina_EU'],
  },
  cme: {
    title: 'ציוד מכני הנדסי',
    fields: ['shilda_totzar_en_nm', 'degem_nm', 'sug_tzama_nm'],
  },
  personalImport: {
    title: 'יבוא אישי',
    fields: ['tozeret_nm', 'degem_nm', 'sug_rechev_nm'],
  },
  publicTransport: {
    title: 'רכב ציבורי',
    fields: ['tozeret_nm', 'degem_nm', 'sug_rechev_nm'],
  },
} as const;
export type SpecialtySource = keyof typeof specialtySources;
export type SpecialtyRow = [
  make: string,
  model: string,
  category: string,
  year: number | null,
  count: number,
];
export type SpecialtySnapshot = {
  updatedAt: string;
  total: number;
  rows: SpecialtyRow[];
};
