import type { ClassDef } from '../../../structure'

export const detailVegData: ClassDef = {
  className: 'detail_vegetation_data',
  description: '',
  attributes: [
    {
      key: 'density',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: 'Value of density to vegetation',
    },
    {
      key: 'min_distance',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'max_distance',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'model_scale_tweak_coef',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'density_tweak_coef',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
