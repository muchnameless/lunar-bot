import { days } from '../functions';

// embeds
export const EMBED_MAX_CHARS = 6_000;
export const EMBED_MAX_FIELDS = 25;
export const EMBED_FIELD_MAX_CHARS = 1_024;
export const EMBED_DESCRIPTION_MAX_CHARS = 4_096;

// messages
export const EMBEDS_MAX_AMOUNT = 10;
export const MESSAGE_MAX_CHARS = 2_000;

// members
export const NICKNAME_MAX_CHARS = 32;
export const MAX_TIMEOUT_DURATION = days(28);

// channels
export const WEBHOOKS_MAX_PER_CHANNEL = 10;

// interactions
export const MAX_CHOICES = 25;
export const MAX_PLACEHOLDER_LENGTH = 100;
export const MAX_VALUE_LENGTH = 4_000;

// formatting
export const enum AnsiFormat {
	Normal = 0,
	Bold,
	Underline = 4,
}

export const enum AnsiColour {
	Gray = 30,
	Red,
	Green,
	Yellow,
	Blue,
	Pink,
	Cyan,
	White,
}

export const enum AnsiBackground {
	FireflyDarkBlue = 40,
	Orange,
	MarbleBlue,
	GreyishTurquoise,
	Gray,
	Indigo,
	LightGray,
	White,
}
