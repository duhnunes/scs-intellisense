import type { ClassDef } from '@/src/interfaces/structure'

export const roadDef: ClassDef = {
  className: 'road_def',
  description: '',
  attributes: [
    {
      key: 'full_line_width',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'broken_line_width',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'boundary_dist',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'road_lines',
      type: 'resource_tie',
      isArray: false,
      arrayElementType: undefined,
      description: '/path/to/file.mat',
    },
  ],
}
