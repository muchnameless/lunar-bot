import loader from 'prismarine-chat';
import { MC_CLIENT_VERSION } from '#root/lib/constants/minecraft.js'; // fix circular

export const PrismarineMessage = loader(MC_CLIENT_VERSION);
