import type { ClassDef } from '../../../structure'

export const journeyDetour: ClassDef = {
  className: 'journey_detour',
  attributes: [
    {
      key: 'cutscene',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'lane_idx',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'lane_count',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'type',
      type: 'token',
      isArray: false,
      description: '',
    },
  ],
}
