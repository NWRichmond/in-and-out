export const defaultConfig = {
  periodStart: '2026-02-01',
  periodEnd: '2026-07-31',
  gutterOpen: true,
  notes:
    'Source: H1 2026 Performance Context. "OOO / PTO" is a single merged figure and is not broken out by holiday vs. personal time off. Security-response days reflect the 8 non-OOO weekdays of the May 18–29 emergency; May 25 and 29 within that window are counted under OOO.',
  categories: [
    {
      id: 'security',
      name: 'Security response day',
      color: '#c0392b',
      dates: [
        '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
        '2026-05-22', '2026-05-26', '2026-05-27', '2026-05-28',
      ],
    },
    {
      id: 'offsite',
      name: 'Department offsite',
      color: '#8e44ad',
      dates: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
    },
    {
      id: 'ai',
      name: 'AI learning day',
      color: '#d4a017',
      dates: ['2026-03-17', '2026-03-18'],
    },
    {
      id: 'ooo',
      name: 'OOO / PTO',
      color: '#2980b9',
      dates: [
        '2026-02-26', '2026-03-05', '2026-03-23', '2026-03-26', '2026-04-03',
        '2026-05-25', '2026-05-29', '2026-06-15', '2026-06-16', '2026-06-17',
        '2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23', '2026-06-24',
        '2026-06-25', '2026-06-26', '2026-07-03', '2026-07-06',
      ],
    },
  ],
};
