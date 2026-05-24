import type { ClassDef } from '../../../structure'

export const roadDef: ClassDef = {
  className: 'road_def',
  attributes: [
    {
      key: 'full_line_width',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'broken_line_width',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'boundary_dist',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'road_lines',
      type: 'resource_tie',
      isArray: false,
      description: '/path/to/file.mat',
    },
  ],
}
