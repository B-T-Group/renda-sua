import {
  findOverlappingSlots,
  findZeroLengthSlot,
} from './food-slot-validation.util';

describe('findZeroLengthSlot', () => {
  it('flags a window that starts and ends at the same time', () => {
    const actual = findZeroLengthSlot([
      { day_of_week: 1, start_time: '12:00', end_time: '12:00' },
    ]);

    expect(actual).not.toBeNull();
  });

  it('accepts normal and overnight windows', () => {
    const actual = findZeroLengthSlot([
      { day_of_week: 1, start_time: '12:30', end_time: '16:00' },
      { day_of_week: 5, start_time: '20:00', end_time: '02:00' },
    ]);

    expect(actual).toBeNull();
  });
});

describe('findOverlappingSlots', () => {
  it('accepts two windows on the same day that do not touch', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '12:00', end_time: '15:00' },
      { day_of_week: 1, start_time: '18:00', end_time: '21:00' },
    ]);

    expect(actual).toBeNull();
  });

  it('accepts windows that meet exactly end to start', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '12:00', end_time: '15:00' },
      { day_of_week: 1, start_time: '15:00', end_time: '18:00' },
    ]);

    expect(actual).toBeNull();
  });

  it('flags overlapping windows on the same day', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '12:00', end_time: '16:00' },
      { day_of_week: 1, start_time: '15:00', end_time: '18:00' },
    ]);

    expect(actual).not.toBeNull();
  });

  it('accepts the same window on different days', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '12:00', end_time: '16:00' },
      { day_of_week: 2, start_time: '12:00', end_time: '16:00' },
    ]);

    expect(actual).toBeNull();
  });

  it('flags an overnight window colliding with the next morning', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '20:00', end_time: '02:00' },
      { day_of_week: 2, start_time: '01:00', end_time: '05:00' },
    ]);

    expect(actual).not.toBeNull();
  });

  it('accepts an overnight window ending before the next morning window', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 1, start_time: '20:00', end_time: '02:00' },
      { day_of_week: 2, start_time: '06:00', end_time: '10:00' },
    ]);

    expect(actual).toBeNull();
  });

  it('flags a Saturday overnight window colliding with Sunday morning', () => {
    const actual = findOverlappingSlots([
      { day_of_week: 6, start_time: '22:00', end_time: '03:00' },
      { day_of_week: 0, start_time: '02:00', end_time: '06:00' },
    ]);

    expect(actual).not.toBeNull();
  });

  it('accepts an empty schedule', () => {
    expect(findOverlappingSlots([])).toBeNull();
  });
});
