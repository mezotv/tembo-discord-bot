interface LogContext {
	[key: string]: unknown;
}

interface LogEntry {
	level: "info" | "warn" | "error" | "debug";
	message: string;
	timestamp: string;
	context?: LogContext;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

function createLogEntry(
	level: LogEntry["level"],
	message: string,
	context?: LogContext,
	error?: unknown,
): LogEntry {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
	};

	if (context && Object.keys(context).length > 0) {
		entry.context = context;
	}

	if (error instanceof Error) {
		entry.error = {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	} else if (error !== undefined) {
		entry.error = {
			name: "Unknown",
			message: String(error),
		};
	}

	return entry;
}

export const logger = {
	info(message: string, context?: LogContext): void {
		const entry = createLogEntry("info", message, context);
		console.log(JSON.stringify(entry));
	},

	warn(message: string, context?: LogContext): void {
		const entry = createLogEntry("warn", message, context);
		console.warn(JSON.stringify(entry));
	},

	error(message: string, error: unknown, context?: LogContext): void {
		const entry = createLogEntry("error", message, context, error);
		console.error(JSON.stringify(entry));
	},

	debug(message: string, context?: LogContext): void {
		const entry = createLogEntry("debug", message, context);
		console.debug(JSON.stringify(entry));
	},

	command(
		commandName: string,
		userId: string,
		success: boolean,
		duration?: number,
	): void {
		this.info("Command executed", {
			command: commandName,
			userId,
			success,
			duration,
		});
	},

	apiCall(
		endpoint: string,
		method: string,
		statusCode: number,
		duration?: number,
	): void {
		const level = statusCode >= 400 ? "error" : "info";
		const entry = createLogEntry(level, "API call", {
			endpoint,
			method,
			statusCode,
			duration,
		});

		if (level === "error") {
			console.error(JSON.stringify(entry));
		} else {
			console.log(JSON.stringify(entry));
		}
	},
};
