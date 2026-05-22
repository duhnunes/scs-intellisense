import type { ClassDef } from '../../../structure'

export const journeyEventsDetourData: ClassDef = {
  className: 'journey_events_detour_data',
  attributes: [
    {
      key: 'min_game_time_delay',
      type: 'fixed',
      isArray: false,
      description:
        '2400 -> 4 (hours) * 60 (hour2min) * 20 (map scale) / 2 (some time spend in city)',
    },
    {
      key: 'max_game_time_delay',
      type: 'fixed',
      isArray: false,
      description:
        '4800 -> 8 (hours) * 60 (hour2min) * 20 (map scale) / 2 (some time spend in city)',
    },
    {
      key: 'minimal_level',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'disabled_items',
      type: 'float',
      isArray: true,
      arrayElementType: 'float',
      description: '',
    },
  ],
}
