import type { ClassDef } from '@/src/interfaces/structure'

export const soundItemReverb: ClassDef = {
  className: 'sound_item_reverb',
  description: '',
  attributes: [
    {
      key: 'name',
      type: 'string',
      isArray: false,
      arrayElementType: undefined,
      description: 'Name from sound',
    },
    {
      key: 'max_dist',
      type: 'fixed',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
    {
      key: 'item_color',
      type: 'string', // ??
      isArray: false,
      arrayElementType: undefined,
      description:
        'Item color: 0xAABBGGRR (hexadecimal) - AA = opacity (max AA = ff - full opacity; min AA = 20 - max. transparency)',
    },
    {
      key: 'decay_time',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Reverberation decay time at low-frequencies in milliseconds.  Ranges from 100.0 to 20000.0. Default is 1500.',
    },
    {
      key: 'early_delay',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Delay time of first reflection in milliseconds.  Ranges from 0.0 to 300.0.  Default is 20.',
    },
    {
      key: 'late_delay',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Late reverberation delay time relative to first reflection in milliseconds.  Ranges from 0.0 to 100.0.  Default is 40.',
    },
    {
      key: 'hf_reference',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Reference frequency for high-frequency decay in Hz.  Ranges from 20.0 to 20000.0. Default is 5000.',
    },
    {
      key: 'hf_decay_ratio',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'High-frequency decay time relative to decay time in percent.  Ranges from 10.0 to 100.0. Default is 50.',
    },
    {
      key: 'diffusion',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Reverberation diffusion (echo density) in percent.  Ranges from 0.0 to 100.0.  Default is 100.',
    },
    {
      key: 'density',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Reverberation density (modal density) in percent.  Ranges from 0.0 to 100.0.  Default is 100.',
    },
    {
      key: 'low_shelf_frequency',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Transition frequency of low-shelf filter in Hz.  Ranges from 20.0 to 1000.0. Default is 250.',
    },
    {
      key: 'low_shelf_gain',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Gain of low-shelf filter in dB.  Ranges from -36.0 to 12.0.  Default is 0.',
    },
    {
      key: 'high_cut',
      type: ['float', 'fixed'],
      isArray: false,
      arrayElementType: undefined,
      description:
        'Cutoff frequency of low-pass filter in Hz.  Ranges from 20.0 to 20000.0. Default is 20000.',
    },
    {
      key: 'early_late_mix',
      type: ['float', 'fixed'],
      isArray: false,
      arrayElementType: undefined,
      description:
        'Blend ratio of late reverb to early reflections in percent.  Ranges from 0.0 to 100.0.  Default is 50.',
    },
    {
      key: 'wet_level',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Reverb signal level in dB.  Ranges from -80.0 to 20.0.  Default is -6.',
    },
    {
      key: 'dry_level',
      type: 'float',
      isArray: false,
      arrayElementType: undefined,
      description:
        'Dry signal level in dB.  Ranges from -80.0 to 20.0.  Default is 0.',
    },
    {
      key: 'ceiling',
      type: 'bool',
      isArray: false,
      arrayElementType: undefined,
      description: '',
    },
  ],
}
