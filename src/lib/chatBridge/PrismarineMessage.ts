import loader from 'prismarine-chat';
import { MC_CLIENT_VERSION } from '../constants/minecraft'; // fix circular

export const PrismarineMessage = loader(MC_CLIENT_VERSION);
