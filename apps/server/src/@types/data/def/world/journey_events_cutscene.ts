import type { ClassDef } from '../../../structure'

export const journeyEventsCutscene: ClassDef = {
  className: 'journey_events_cutscene',
  description: '',
  attributes: [
    {
      key: 'cutscene_tokens',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'left_width',
      type: ['float', 'fixed'],
      isArray: false,
      arrayElementType: undefined,
      description: 'value in meters',
    },
    {
      key: 'right_width',
      type: ['float', 'fixed'],
      isArray: false,
      arrayElementType: undefined,
      description: 'value in meters',
    },
    {
      key: 'sequence_mode',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'lane_height',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'align_buildings',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
