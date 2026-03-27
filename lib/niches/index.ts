import { MedspaNiche } from './medspa';
import { GeneralNiche } from './general';
import { GloMedSpaNiche } from './glo-medspa';

export const NicheRegistry = {
    medspa: MedspaNiche,
    glo_medspa: GloMedSpaNiche,
    general: GeneralNiche,
    // Add future niches here (dental, law, etc)
};

export function getNicheConfig(nicheId: string | null | undefined) {
    if (!nicheId || !NicheRegistry[nicheId as keyof typeof NicheRegistry]) {
        return NicheRegistry.general;
    }
    return NicheRegistry[nicheId as keyof typeof NicheRegistry];
}
