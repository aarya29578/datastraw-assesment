export const OPERATING_PATTERNS = {
  DAYS_365: '365_DAYS',
  EXCEPT_HOLIDAYS: 'ALL_EXCEPT_HOLIDAYS',
  MON_TO_SAT: 'MON_TO_SAT',
  MON_TO_FRI: 'MON_TO_FRI',
  CUSTOM: 'CUSTOM',
};

export const OPERATING_PATTERN_LABELS = {
  [OPERATING_PATTERNS.DAYS_365]: '365-Day Operations (Everyday)',
  [OPERATING_PATTERNS.EXCEPT_HOLIDAYS]: 'All Days Except Public Holidays',
  [OPERATING_PATTERNS.MON_TO_SAT]: 'Monday to Saturday (Sundays Off)',
  [OPERATING_PATTERNS.MON_TO_FRI]: 'Monday to Friday (Weekends Off)',
  [OPERATING_PATTERNS.CUSTOM]: 'Custom Operating Days',
};
