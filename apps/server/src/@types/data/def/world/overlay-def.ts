import type { ClassDef } from '../../../structure'

export const overlayDef: ClassDef = {
  className: 'overlay_def',
  attributes: [
    {
      key: 'city_names',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: 'This is the name from cities',
    },
    {
      key: 'road_names',
      type: 'string',
      isArray: true,
      arrayElementType: 'string',
      description: '',
    },
  ],
}
