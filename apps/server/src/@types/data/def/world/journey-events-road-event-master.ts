import type { ClassDef } from '../../../structure'

export const journeyEventsRoadEventData: ClassDef = {
  className: 'journey_events_road_event_data',
  attributes: [
    {
      key: 'max_road_events_count',
      type: 'fixed',
      isArray: true,
      arrayElementType: 'fixed',
      description: '',
    },
    {
      key: 'min_road_events_distance',
      type: 'float',
      isArray: true,
      arrayElementType: 'float',
      description: 'meters // 1500.0',
    },
    {
      key: 'probability',
      type: 'float',
      isArray: true,
      arrayElementType: 'float',
      description: '',
    },
  ],
}
