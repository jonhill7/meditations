// Short passages for mornings when there is only time for a verse.
export const VERSES = [
  'PSA 5:3', 'LAM 3:22-23', 'PSA 143:8', 'ISA 40:31', 'PRO 3:5-6', 'JHN 3:16', 'ROM 8:28',
  'PHP 4:6-7', 'MAT 11:28-30', 'PSA 46:10', 'JOS 1:9', 'ISA 41:10', 'JER 29:11', 'PSA 23:1-3',
  'ROM 12:2', '2CO 5:17', 'GAL 2:20', 'EPH 2:8-10', 'PHP 4:13', 'HEB 11:1', 'JAS 1:2-4',
  '1PE 5:6-7', '1JN 1:9', 'MIC 6:8', 'PSA 119:105', 'PSA 37:4-5', 'MAT 6:33-34', 'ROM 5:8',
  'COL 3:23-24', '2TI 1:7', 'HEB 4:16', 'PSA 51:10-12', 'ISA 26:3', 'ZEP 3:17', 'NUM 6:24-26',
  'DEU 31:8', 'PSA 27:1', 'PSA 34:18', 'PSA 90:12', 'PSA 139:23-24', 'PRO 16:3', 'PRO 4:23',
  'ECC 3:1', 'ISA 43:2', 'ISA 53:5', 'ISA 55:8-9', 'MAT 5:14-16', 'MAT 22:37-39', 'MAT 28:19-20',
  'MRK 10:45', 'LUK 6:31', 'LUK 9:23', 'JHN 1:1-5', 'JHN 8:12', 'JHN 10:10', 'JHN 11:25-26',
  'JHN 13:34-35', 'JHN 14:6', 'JHN 14:27', 'JHN 15:5', 'JHN 16:33', 'ACT 1:8', 'ROM 3:23-24',
  'ROM 6:23', 'ROM 8:1', 'ROM 8:38-39', 'ROM 10:9', 'ROM 12:12', 'ROM 15:13', '1CO 10:13',
  '1CO 13:4-7', '1CO 15:58', '2CO 4:16-18', '2CO 12:9', 'GAL 5:22-23', 'GAL 6:9', 'EPH 3:20-21',
  'EPH 4:32', 'EPH 6:10-11', 'PHP 1:6', 'PHP 2:3-4', 'PHP 3:13-14', 'PHP 4:8', 'COL 3:12-14',
  '1TH 5:16-18', '2TI 3:16-17', 'HEB 10:23-25', 'HEB 12:1-2', 'HEB 13:8', 'JAS 1:5', 'JAS 1:19-20',
  'JAS 4:8', '1PE 3:15', '1JN 4:18-19', 'REV 21:4', 'GEN 1:27', 'GEN 50:20', 'EXO 14:14',
  'DEU 6:5-7', '1SA 16:7', '2CH 7:14', 'NEH 8:10', 'JOB 19:25', 'PSA 1:1-3', 'PSA 16:11',
  'PSA 19:14', 'PSA 32:8', 'PSA 40:1-3', 'PSA 42:11', 'PSA 55:22', 'PSA 62:1-2', 'PSA 73:26',
  'PSA 91:1-2', 'PSA 100:4-5', 'PSA 103:1-5', 'PSA 118:24', 'PSA 121:1-2', 'PSA 127:1',
  'PSA 145:18', 'PSA 147:3', 'PRO 15:1', 'PRO 18:10', 'PRO 19:21', 'PRO 27:17', 'ISA 30:15',
  'ISA 40:8', 'ISA 58:11', 'JER 17:7-8', 'JER 33:3', 'EZK 36:26', 'HAB 3:17-18', 'MAL 3:10',
  'MAT 5:3-9', 'MAT 6:9-13', 'MAT 7:7-8', 'MRK 11:24', 'LUK 1:37', 'LUK 12:25-26', 'JHN 3:30',
  'JHN 14:1-3', 'ACT 2:42', 'ROM 1:16', 'ROM 8:31', '1CO 16:13-14', '2CO 9:7', 'GAL 5:1',
  'EPH 5:15-16', 'COL 3:1-2', 'COL 4:2', '1TH 5:11', '2TH 3:3', '1TI 4:12', 'TIT 3:4-5',
  'HEB 4:12', 'HEB 13:5-6', 'JAS 5:16', '1PE 1:3', '2PE 3:9', '1JN 3:1', '1JN 4:7-8', 'REV 3:20',
];

export function verseForDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return VERSES[dayNumber % VERSES.length];
}
