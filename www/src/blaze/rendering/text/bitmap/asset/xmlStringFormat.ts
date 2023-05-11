import { settings } from '../../../../settings/settings.js';
import { XMLFormat } from './xmlFormat.js';

import type { BitmapFontData } from '../BitmapFont.js';

export const XMLStringFormat = {
    test(data: unknown): boolean
    {
        if (typeof data === 'string' && data.includes('<font>'))
        {
            return XMLFormat.test(settings.ADAPTER.parseXML(data));
        }

        return false;
    },

    parse(data: string): BitmapFontData
    {
        return XMLFormat.parse(settings.ADAPTER.parseXML(data));
    }
};
