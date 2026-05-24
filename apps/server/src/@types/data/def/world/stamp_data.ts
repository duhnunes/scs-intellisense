import type { ClassDef } from '../../../structure'

export const stampData: ClassDef = {
  className: 'stamp_data',
  attributes: [
    {
      key: 'stamp_name',
      type: 'string',
      isArray: false,
      description: 'Name from stamp',
    },
    {
      key: 'stamp_path',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.btf',
    },
  ],
}
