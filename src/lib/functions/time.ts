/* eslint-disable @typescript-eslint/no-shadow */
const enum Time {
	Millisecond = 1,
	Second = 1_000,
	Minute = Second * 60,
	Hour = Minute * 60,
	Day = Hour * 24,
	Week = Day * 7,
	Year = Day * 365.25,
	Month = Year / 12,
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
 * converts a number of weeks to milliseconds
 * @param weeks
 */
export const weeks = (weeks: number) => weeks * Time.Week;

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
