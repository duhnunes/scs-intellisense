import type { ClassDef } from '../../../structure'

export const triggerAction: ClassDef = {
  className: 'trigger_action',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'command',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'str_params',
      type: undefined,
      isArray: true,
      arrayElementType: 'string',
      description:
        'for customizable actions are used only as tooltips in editor',
    },
    {
      key: 'rule',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'type',
      type: 'token',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'num_params',
      type: undefined,
      isArray: true,
      arrayElementType: ['float', 'fixed'],
      description: `
        Some tips from original file:
          - 0: checkmark (default)
          - 0: infinite (default)
          - 1: info
          - 2: warning
          - 3: Delay in [s]
      `,
    },
  ],
}
