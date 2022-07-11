/**
 * [0, 1, 2, 3] -> [0, 1, 3, 6]
 * @param array
 */
export function toTotal(array: Readonly<number[]>): Readonly<number[]>;
export function toTotal(array: number[]): number[];
export function toTotal(array: Readonly<number[]>) {
	const total = [...array];

	for (let i = 1; i < array.length; ++i) {
		total[i] = total[i - 1]! + array[i]!;
	}

	return total;
}
