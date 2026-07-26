/**
 * Carrier-specific call-forwarding instructions shown in Phone Setup.
 * `{number}` placeholders are replaced with the company's AI number.
 */
export interface CarrierGuide {
  id: string;
  label: string;
  steps: string[];
  disable?: string;
}

export const CARRIER_GUIDES: CarrierGuide[] = [
  {
    id: 'verizon',
    label: 'Verizon',
    steps: [
      'From your business phone, dial *72 followed by {number}, then press Call.',
      'Wait for the confirmation tone or message, then hang up.',
      'To forward only when you don’t answer, use *71 instead of *72.',
    ],
    disable: 'Dial *73 to turn forwarding off.',
  },
  {
    id: 'att',
    label: 'AT&T',
    steps: [
      'From your business phone, dial **21*{number}# and press Call.',
      'Wait for the confirmation, then hang up.',
      'To forward only unanswered calls, dial **61*{number}# instead.',
    ],
    disable: 'Dial ##21# to turn forwarding off.',
  },
  {
    id: 'tmobile',
    label: 'T-Mobile',
    steps: [
      'From your business phone, dial **21*{number}# and press Call.',
      'Wait for the confirmation, then hang up.',
      'To forward only unanswered calls, dial **61*{number}# instead.',
    ],
    disable: 'Dial ##21# to turn forwarding off.',
  },
  {
    id: 'comcast',
    label: 'Comcast Business',
    steps: [
      'From your business line, dial *72 and wait for the tone.',
      'Enter {number}; forwarding activates after the confirmation.',
      'You can also manage forwarding in the Comcast Business portal under Voice → Call Forwarding.',
    ],
    disable: 'Dial *73 to turn forwarding off.',
  },
  {
    id: 'ringcentral',
    label: 'RingCentral',
    steps: [
      'Sign in to the RingCentral admin portal.',
      'Open Phone System → your business number → Call Handling.',
      'Add {number} as the forwarding destination for all hours (or after no answer).',
    ],
  },
  {
    id: 'googlevoice',
    label: 'Google Voice',
    steps: [
      'Open Google Voice settings for your business number.',
      'Under Calls → Call Forwarding, add {number} as a linked forwarding number.',
      'Verify the number when Google Voice calls or texts it.',
    ],
  },
  {
    id: 'grasshopper',
    label: 'Grasshopper',
    steps: [
      'Open the Grasshopper app or web portal.',
      'Go to Settings → Call Forwarding for your business number.',
      'Set {number} as the destination for all calls (or as the no-answer fallback).',
    ],
  },
  {
    id: 'dialpad',
    label: 'Dialpad',
    steps: [
      'Sign in to the Dialpad admin portal.',
      'Open Admin Settings → your office number → Routing.',
      'Add {number} as the forwarding destination.',
    ],
  },
  {
    id: 'openphone',
    label: 'OpenPhone',
    steps: [
      'Open OpenPhone → Settings → Phone Numbers.',
      'Select your business number and choose Call Forwarding.',
      'Enter {number} and save.',
    ],
  },
  {
    id: 'other',
    label: 'Other / not sure',
    steps: [
      'Most US carriers: dial *72 followed by {number} from your business phone, then hang up after the confirmation.',
      'If that doesn’t work, search your provider’s help for “call forwarding” or ask them to forward your line to {number}.',
      'Prefer “no-answer” forwarding? Ask your provider for conditional forwarding so the receptionist only picks up calls you miss.',
    ],
    disable: 'On most carriers, *73 turns forwarding off.',
  },
];
