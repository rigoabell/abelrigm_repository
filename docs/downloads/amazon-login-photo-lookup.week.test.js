const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, 'amazon-login-photo-lookup.txt'),
  'utf8'
);
const start = source.indexOf('/* week-hours:start */');
const end = source.indexOf('/* week-hours:end */');
if (start < 0 || end < start) {
  throw new Error('Week-hours block was not found in the photo lookup script');
}

const weekHours = new Function(
  `${source.slice(start, end)}
  return { punchKind, readAttendancePunch, summarizeWeek, formatWeekLine, weekQueryDates, formatDayLabel, formatHours, shiftOf };`
)();

let failed = 0;

function check(name, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) {
    console.log('ok  ' + name);
    return;
  }
  failed += 1;
  console.error('FAIL ' + name);
  console.error('  expected ' + JSON.stringify(expected));
  console.error('  actual   ' + JSON.stringify(actual));
}

function at(year, month, day, hours, minutes) {
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function punch(kind, year, month, day, hours, minutes) {
  return { kind, timestamp: at(year, month, day, hours, minutes) };
}

function slot(summary, isoDate, shift) {
  return summary.slots.find((item) => item.date === isoDate && item.shift === shift);
}

const fridayMorning = new Date(2026, 10, 13, 10, 0, 0, 0);

check(
  'query dates cover the day before Sunday through Friday',
  weekHours.weekQueryDates(fridayMorning),
  ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
);

const dayShift = weekHours.summarizeWeek(
  [
    punch('clock-in', 2026, 11, 8, 6, 0),
    punch('meal-start', 2026, 11, 8, 11, 0),
    punch('meal-end', 2026, 11, 8, 11, 30),
    punch('clock-out', 2026, 11, 8, 16, 30),
  ],
  fridayMorning
);
check('Sunday day shift is 10 hours after a 30 minute meal', slot(dayShift, '2026-11-08', 'Day').minutes, 600);
check('Sunday night stays empty after a day shift', slot(dayShift, '2026-11-08', 'Night').minutes, 0);
check('Friday day is listed and still empty', slot(dayShift, '2026-11-13', 'Day').minutes, 0);
check('Friday night has not started', slot(dayShift, '2026-11-13', 'Night'), undefined);

const nightShift = weekHours.summarizeWeek(
  [
    punch('clock-in', 2026, 11, 8, 18, 0),
    punch('meal-start', 2026, 11, 9, 0, 0),
    punch('meal-end', 2026, 11, 9, 0, 30),
    punch('clock-out', 2026, 11, 9, 4, 30),
  ],
  fridayMorning
);
check('Sunday night keeps the hours after midnight', slot(nightShift, '2026-11-08', 'Night').minutes, 600);
check('Monday day does not take the overnight hours', slot(nightShift, '2026-11-09', 'Day').minutes, 0);
check(
  'week line names the evening for a night shift',
  nightShift.line.startsWith('Sun 11/8 Night 10h 00m'),
  true
);

const openShift = weekHours.summarizeWeek(
  [punch('clock-in', 2026, 11, 13, 6, 0)],
  fridayMorning
);
check('an open Friday shift counts through now', slot(openShift, '2026-11-13', 'Day').minutes, 240);
check('an open Friday shift stays on the clock', slot(openShift, '2026-11-13', 'Day').open, true);
check('open hours say on clock', openShift.line.includes('Fri 11/13 Day 4h 00m on clock'), true);

const previousSaturdayNight = weekHours.summarizeWeek(
  [
    punch('clock-in', 2026, 11, 7, 18, 0),
    punch('clock-out', 2026, 11, 8, 4, 0),
  ],
  new Date(2026, 10, 8, 10, 0, 0, 0)
);
check('Saturday night ending Sunday morning is last week', previousSaturdayNight.totalMinutes, 0);
check('last week has no hours line', previousSaturdayNight.line, 'No hours this week');

const earlyIn = weekHours.summarizeWeek(
  [
    punch('clock-in', 2026, 11, 8, 5, 50),
    punch('clock-out', 2026, 11, 8, 16, 0),
  ],
  fridayMorning
);
check('minutes before 6:00 AM stay on the previous night', slot(earlyIn, '2026-11-08', 'Day').minutes, 600);
check('the early minutes are outside this week', earlyIn.totalMinutes, 600);

const splitShift = weekHours.summarizeWeek(
  [
    punch('clock-in', 2026, 11, 13, 17, 0),
    punch('clock-out', 2026, 11, 13, 19, 0),
  ],
  new Date(2026, 10, 13, 20, 0, 0, 0)
);
check('5:00 PM to 6:00 PM is Friday day', slot(splitShift, '2026-11-13', 'Day').minutes, 60);
check('6:00 PM to 7:00 PM is Friday night', slot(splitShift, '2026-11-13', 'Night').minutes, 60);

check('5:59 PM is still day', weekHours.shiftOf(new Date(2026, 10, 13, 17, 59)).shift, 'Day');
check('6:00 PM starts night', weekHours.shiftOf(new Date(2026, 10, 13, 18, 0)).shift, 'Night');
check('5:59 AM belongs to the previous night', weekHours.shiftOf(new Date(2026, 10, 9, 5, 59)).date, '2026-11-08');
check('a header row is not a punch', weekHours.readAttendancePunch(['Employee ID', 'Name', '', '', 'Punch Type', 'Punch Time']), null);
check(
  'a clock-in row is read from the attendance columns',
  weekHours.readAttendancePunch(['123', 'Doe, Jane', '', '', 'Clock In', '2026-11-13 06:00:00']),
  { kind: 'clock-in', timestamp: Date.parse('2026-11-13 06:00:00') }
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all week-hours checks passed');
