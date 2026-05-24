import type { ClassDef } from '../../../structure'

export const journeyEventsDetour: ClassDef = {
  className: 'journey_events_detour',
  description: '',
  attributes: [
    {
      key: 'cutscene',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'lane_idx',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'lane_count',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'type',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
