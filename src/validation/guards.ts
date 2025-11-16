export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

export function isNonEmptyString(value: unknown): value is string {
	return isString(value) && value.trim().length > 0;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}
