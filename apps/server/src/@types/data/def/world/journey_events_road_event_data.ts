import type { ClassDef } from '../../../structure'

export const journeyEventsRoadEventData: ClassDef = {
  className: 'journey_events_road_event_data',
  description: '',
  attributes: [
    {
      key: 'max_road_events_count',
      type: undefined,
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'min_road_events_distance',
      type: undefined,
      isArray: true,
      arrayElementType: 'float',
      description: 'meters // 1500.0',
    },
    {
      key: 'probability',
      type: undefined,
      isArray: true,
      arrayElementType: 'float',
      description: '',
    },
  ],
}
