import type { ClassDef } from '../../../structure'

export const soundItemData: ClassDef = {
  className: 'sound_item_data',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from sound',
    },
    {
      key: 'sound_path',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/sound/file.bank#id',
    },
    {
      key: 'sound_sfx',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/sound/file.bank#id',
    },
    {
      key: 'sfx_count',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'max_dist',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'item_color',
      type: 'string', // ??
      isArray: false,
      arrayElementType: undefined,
      description:
        'Item color: 0xAABBGGRR (hexadecimal) - AA = opacity (max AA = ff - full opacity; min AA = 20 - max. transparency)',
    },
    {
      key: 'reverb',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
