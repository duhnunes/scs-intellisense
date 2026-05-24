import type { ClassDef } from '../../../structure'

export const journeyEventsDetourData: ClassDef = {
  className: 'journey_events_detour_data',
  description: '',
  attributes: [
    {
      key: 'min_game_time_delay',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description:
        '2400 -> 4 (hours) * 60 (hour2min) * 20 (map scale) / 2 (some time spend in city)',
    },
    {
      key: 'max_game_time_delay',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description:
        '4800 -> 8 (hours) * 60 (hour2min) * 20 (map scale) / 2 (some time spend in city)',
    },
    {
      key: 'minimal_level',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'disabled_items',
      type: undefined,
      isArray: true,
      arrayElementType: 'float', // ??
      description: '',
    },
  ],
}
