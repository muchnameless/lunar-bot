/* eslint-disable @typescript-eslint/no-shadow */
const enum Time {
	Millisecond = 1,
	Second = 1_000,
	Minute = 60_000,
	Hour = 3_600_000,
	Day = 86_400_000,
	Month = 2_628_000_000,
	Year = 31_536_000_000,
}

/**
 * converts a number of seconds to milliseconds
 * @param seconds
 */
export const seconds = (seconds: number) => seconds * Time.Second;

/**
 * converts a number of minutes to milliseconds
 * @param minutes
 */
export const minutes = (minutes: number) => minutes * Time.Minute;

/**
 * converts a number of hours to milliseconds
 * @param hours
 */
export const hours = (hours: number) => hours * Time.Hour;

/**
 * converts a number of days to milliseconds
 * @param days
 */
export const days = (days: number) => days * Time.Day;

/**
 * converts a number of months to milliseconds.
 * @param months
 */
export const months = (months: number) => months * Time.Month;

/**
 * converts a number of years to milliseconds
 * @param years
 */
export const years = (years: number) => years * Time.Year;
