import type { ClassDef } from '../../../structure'

export const loaderGranMatch: ClassDef = {
  className: 'loader_grab_match',
  attributes: [
    {
      key: 'loader',
      type: 'token',
      isArray: false,
      description: '',
    },
    {
      key: 'grab_types',
      type: 'token',
      isArray: true,
      arrayElementType: 'token',
      description: '',
    },
  ],
}
