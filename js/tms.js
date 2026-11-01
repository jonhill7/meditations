// The Navigators' Topical Memory System: 60 verses in 5 packs of 6 topics.
export const TMS = [
  { pack: 'A', title: 'Live the New Life', topics: [
    ['Christ the Center', ['2CO 5:17'], ['GAL 2:20']],
    ['Obedience to Christ', ['ROM 12:1'], ['JHN 14:21']],
    ['The Word', ['2TI 3:16'], ['JOS 1:8']],
    ['Prayer', ['JHN 15:7'], ['PHP 4:6-7']],
    ['Fellowship', ['MAT 18:20'], ['HEB 10:24-25']],
    ['Witnessing', ['MAT 4:19'], ['ROM 1:16']],
  ] },
  { pack: 'B', title: 'Proclaim Christ', topics: [
    ['All Have Sinned', ['ROM 3:23'], ['ISA 53:6']],
    ["Sin's Penalty", ['ROM 6:23'], ['HEB 9:27']],
    ['Christ Paid the Penalty', ['ROM 5:8'], ['1PE 3:18']],
    ['Salvation Not by Works', ['EPH 2:8-9'], ['TIT 3:5']],
    ['Must Receive Christ', ['JHN 1:12'], ['REV 3:20']],
    ['Assurance of Salvation', ['1JN 5:13'], ['JHN 5:24']],
  ] },
  { pack: 'C', title: "Rely on God's Resources", topics: [
    ['His Spirit', ['1CO 3:16'], ['1CO 2:12']],
    ['His Strength', ['ISA 41:10'], ['PHP 4:13']],
    ['His Faithfulness', ['LAM 3:22-23'], ['NUM 23:19']],
    ['His Peace', ['ISA 26:3'], ['1PE 5:7']],
    ['His Provision', ['ROM 8:32'], ['PHP 4:19']],
    ['His Help in Temptation', ['HEB 2:18'], ['PSA 119:9', 'PSA 119:11']],
  ] },
  { pack: 'D', title: "Be Christ's Disciple", topics: [
    ['Put Christ First', ['MAT 6:33'], ['LUK 9:23']],
    ['Separate from the World', ['1JN 2:15-16'], ['ROM 12:2']],
    ['Be Steadfast', ['1CO 15:58'], ['HEB 12:3']],
    ['Serve Others', ['MRK 10:45'], ['2CO 4:5']],
    ['Give Generously', ['PRO 3:9-10'], ['2CO 9:6-7']],
    ['Develop World Vision', ['ACT 1:8'], ['MAT 28:19-20']],
  ] },
  { pack: 'E', title: 'Grow in Christlikeness', topics: [
    ['Love', ['JHN 13:34-35'], ['1JN 3:18']],
    ['Humility', ['PHP 2:3-4'], ['1PE 5:5-6']],
    ['Purity', ['EPH 5:3'], ['1PE 2:11']],
    ['Honesty', ['LEV 19:11'], ['ACT 24:16']],
    ['Faith', ['HEB 11:6'], ['ROM 4:20-21']],
    ['Good Works', ['GAL 6:9-10'], ['MAT 5:16']],
  ] },
];

// Flat list: { refs, pack, packTitle, topic }.
export const TMS_VERSES = TMS.flatMap(p => p.topics.flatMap(([topic, ...verses]) =>
  verses.map(refs => ({ refs, pack: p.pack, packTitle: p.title, topic }))));
