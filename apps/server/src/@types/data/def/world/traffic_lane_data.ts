import type { ClassDef } from '../../../structure'

export const trafficLaneData: ClassDef = {
  className: 'traffic_lane_data',
  attributes: [
    {
      key: 'speed_class',
      type: 'token',
      isArray: false,
      description:
        "the value is used when determining the country speed limit ('lane_speed_class' attribute in '/def/country/(country_name)/speed_limit.sii')",
    },
    {
      key: 'rank',
      type: 'fixed',
      isArray: false,
      description:
        'used for speed limit and lane type distribution - lane with higher rank is preferred',
    },
    {
      key: 'traffic_rules',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
  ],
}
