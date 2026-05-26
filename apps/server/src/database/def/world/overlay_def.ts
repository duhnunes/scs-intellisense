import type { ClassDef } from '@/src/interfaces/structure'

export const overlayDef: ClassDef = {
  className: 'overlay_def',
  description: '',
  attributes: [
    {
      key: 'city_names',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: 'This is the name from cities',
    },
    {
      key: 'road_names',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
  ],
}
