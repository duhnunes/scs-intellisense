import type { ClassDef } from '../../../structure'

export const journeyEventsCutscene: ClassDef = {
  className: 'journey_events_cutscene',
  attributes: [
    {
      key: 'cutscene_tokens',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'left_width',
      type: ['float', 'fixed'],
      isArray: false,
      description: 'value in meters',
    },
    {
      key: 'right_width',
      type: ['float', 'fixed'],
      isArray: false,
      description: 'value in meters',
    },
    {
      key: 'sequence_mode',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'lane_height',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'align_buildings',
      type: 'bool',
      isArray: false,
      description: '',
    },
  ],
}
