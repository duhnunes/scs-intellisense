import type { ClassDef } from '../../../structure'

export const detailVegData: ClassDef = {
  className: 'detail_vegetation_data',
  attributes: [
    {
      key: 'density',
      type: 'fixed',
      isArray: false,
      description: 'Value of density to vegetation',
    },
    {
      key: 'min_distance',
      type: 'float',
      isArray: false,
      description: '',
    },
    {
      key: 'max_distance',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'model_scale_tweak_coef',
      type: 'fixed',
      isArray: false,
      description: '',
    },
    {
      key: 'density_tweak_coef',
      type: 'fixed',
      isArray: false,
      description: '',
    },
  ],
}
