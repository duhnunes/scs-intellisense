import type { ClassDef } from '../../../structure'

export const loaderGranMatch: ClassDef = {
  className: 'loader_grab_match',
  description: '',
  attributes: [
    {
      key: 'loader',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'grab_types',
      type: undefined,
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
  ],
}
