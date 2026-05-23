import type { ClassDef } from '../../../structure'

export const moverAction: ClassDef = {
  className: 'mover_action',
  attributes: [
    {
      key: 'action_name',
      type: 'string',
      isArray: false,
      description: 'This is the name from your action mover.',
    },
    {
      key: 'model_desc',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/file.pma',
    },
    {
      key: 'animation_params',
      type: 'string',
      isArray: false,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'sounds',
      type: 'resource_tie',
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/sounds/file.bank#id)',
    },
    {
      key: 'sound_params',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'timer_params',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'group_tags',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'type',
      type: 'string',
      isArray: false,
      description: '',
    },
  ],
}
