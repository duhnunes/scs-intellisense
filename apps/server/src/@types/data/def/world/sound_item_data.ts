import type { ClassDef } from '../../../structure'

export const soundItemData: ClassDef = {
  className: 'sound_item_data',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      description: 'Name from sound',
    },
    {
      key: 'sound_path',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/sound/file.bank#id',
    },
    {
      key: 'sound_sfx',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/sound/file.bank#id',
    },
    {
      key: 'sfx_count',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'max_dist',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'item_color',
      type: 'string', // ??
      isArray: false,
      description:
        'Item color: 0xAABBGGRR (hexadecimal) - AA = opacity (max AA = ff - full opacity; min AA = 20 - max. transparency)',
    },
    {
      key: 'reverb',
      type: 'token',
      isArray: false,
      description: '',
    },
  ],
}
