import type { ClassDef } from '../../../structure'

export const moverAnim: ClassDef = {
  className: 'mover_anim',
  description: '',
  attributes: [
    {
      key: 'model_anim',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.pma',
    },
    {
      key: 'group_tags',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'props',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
    {
      key: 'sound_path',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/sound/file.bank#id',
    },
    {
      key: 'anim_type',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
