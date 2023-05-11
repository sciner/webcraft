import type { StructsAndGroups } from './extractStructAndGroups.js';
import type { ProgramLayout } from './GpuProgram.js';

export function generateLayoutHash({ groups }: StructsAndGroups): ProgramLayout
{
    const layout: ProgramLayout = [];

    for (let i = 0; i < groups.length; i++)
    {
        const group = groups[i];

        if (!layout[group.group])
        {
            layout[group.group] = {};
        }

        layout[group.group][group.name] = group.binding;
    }

    return layout;
}
