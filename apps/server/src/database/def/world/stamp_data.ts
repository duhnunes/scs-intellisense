import type { ClassDef } from '@/src/interfaces/structure'

export const stampData: ClassDef = {
  className: 'stamp_data',
  description: '',
  attributes: [
    {
      key: 'stamp_name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from stamp',
    },
    {
      key: 'stamp_path',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.btf',
    },
  ],
}
