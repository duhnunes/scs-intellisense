import type { ClassDef } from '@/src/interfaces/structure'

export const moverAction: ClassDef = {
  className: 'mover_action',
  description: '',
  attributes: [
    {
      key: 'action_name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'This is the name from action mover.',
    },
    {
      key: 'animation_params',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'sounds',
      type: undefined,
      isArray: true,
      arrayElementType: 'resource_tie',
      description: '/path/to/sounds/file.bank#id)',
    },
    {
      key: 'sound_params',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'timer_params',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
    {
      key: 'group_tags',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'type',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
