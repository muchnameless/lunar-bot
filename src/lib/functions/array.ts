/**
 * [0, 1, 2, 3] -> [0, 1, 3, 6]
 *
 * @param array
 */
export function toTotal(array: Readonly<number[]>): Readonly<number[]>;
export function toTotal(array: number[]): number[];
export function toTotal(array: Readonly<number[]>) {
	const total = [...array];

	for (let index = 1; index < array.length; ++index) {
		total[index] = total[index - 1]! + array[index]!;
	}

	return total;
}
