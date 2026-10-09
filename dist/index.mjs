import process$1, { cwd } from "node:process";
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, delimiter, dirname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { PassThrough } from "node:stream";
import readline from "node:readline";
//#region node_modules/.pnpm/@moeru+std@0.1.0-beta.20/node_modules/@moeru/std/dist/error/index.js
const isError = (err) => {
	if ("isError" in Error && Error.isError(new DOMException())) return Error.isError(err);
	if (err === null || typeof err !== "object" && typeof err !== "function") return false;
	if (err instanceof Error) return true;
	const tag = Object.prototype.toString.call(err);
	return tag === "[object DOMException]" || tag === "[object Error]";
};
const isErrorLike = (err) => {
	if (isError(err)) return true;
	if (err == null || typeof err !== "object" && typeof err !== "function") return false;
	return "message" in err && typeof err.message === "string" && "name" in err && typeof err.name === "string";
};
const errorMessageFrom = (err) => isErrorLike(err) ? err.message : err == null ? void 0 : String(err);
//#endregion
//#region node_modules/.pnpm/pathe@2.0.3/node_modules/pathe/dist/shared/pathe.M-eThtNZ.mjs
const _DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
function normalizeWindowsPath(input = "") {
	if (!input) return input;
	return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _ROOT_FOLDER_RE = /^\/([A-Za-z]:)?$/;
function cwd$1() {
	if (typeof process !== "undefined" && typeof process.cwd === "function") return process.cwd().replace(/\\/g, "/");
	return "/";
}
const resolve$1 = function(...arguments_) {
	arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
	let resolvedPath = "";
	let resolvedAbsolute = false;
	for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
		const path = index >= 0 ? arguments_[index] : cwd$1();
		if (!path || path.length === 0) continue;
		resolvedPath = `${path}/${resolvedPath}`;
		resolvedAbsolute = isAbsolute(path);
	}
	resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
	if (resolvedAbsolute && !isAbsolute(resolvedPath)) return `/${resolvedPath}`;
	return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
	let res = "";
	let lastSegmentLength = 0;
	let lastSlash = -1;
	let dots = 0;
	let char = null;
	for (let index = 0; index <= path.length; ++index) {
		if (index < path.length) char = path[index];
		else if (char === "/") break;
		else char = "/";
		if (char === "/") {
			if (lastSlash === index - 1 || dots === 1);
			else if (dots === 2) {
				if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
					if (res.length > 2) {
						const lastSlashIndex = res.lastIndexOf("/");
						if (lastSlashIndex === -1) {
							res = "";
							lastSegmentLength = 0;
						} else {
							res = res.slice(0, lastSlashIndex);
							lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
						}
						lastSlash = index;
						dots = 0;
						continue;
					} else if (res.length > 0) {
						res = "";
						lastSegmentLength = 0;
						lastSlash = index;
						dots = 0;
						continue;
					}
				}
				if (allowAboveRoot) {
					res += res.length > 0 ? "/.." : "..";
					lastSegmentLength = 2;
				}
			} else {
				if (res.length > 0) res += `/${path.slice(lastSlash + 1, index)}`;
				else res = path.slice(lastSlash + 1, index);
				lastSegmentLength = index - lastSlash - 1;
			}
			lastSlash = index;
			dots = 0;
		} else if (char === "." && dots !== -1) ++dots;
		else dots = -1;
	}
	return res;
}
const isAbsolute = function(p) {
	return _IS_ABSOLUTE_RE.test(p);
};
const relative = function(from, to) {
	const _from = resolve$1(from).replace(_ROOT_FOLDER_RE, "$1").split("/");
	const _to = resolve$1(to).replace(_ROOT_FOLDER_RE, "$1").split("/");
	if (_to[0][1] === ":" && _from[0][1] === ":" && _from[0] !== _to[0]) return _to.join("/");
	const _fromCopy = [..._from];
	for (const segment of _fromCopy) {
		if (_to[0] !== segment) break;
		_from.shift();
		_to.shift();
	}
	return [..._from.map(() => ".."), ..._to].join("/");
};
const DEFAULT_CONFIG = {
	lang: void 0,
	message: void 0,
	abortEarly: void 0,
	abortPipeEarly: void 0
};
/**
* Returns the global configuration.
*
* @param config The config to merge.
*
* @returns The configuration.
*/
/* @__NO_SIDE_EFFECTS__ */
function getGlobalConfig(config$1) {
	if (!config$1 && true) return DEFAULT_CONFIG;
	return {
		lang: config$1?.lang ?? void 0,
		message: config$1?.message,
		abortEarly: config$1?.abortEarly ?? void 0,
		abortPipeEarly: config$1?.abortPipeEarly ?? void 0
	};
}
/**
* Stringifies an unknown input to a literal or type string.
*
* @param input The unknown input.
*
* @returns A literal or type string.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _stringify(input) {
	const type = typeof input;
	if (type === "string") return `"${input}"`;
	if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
	if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
	return type;
}
/**
* Adds an issue to the dataset.
*
* @param context The issue context.
* @param label The issue label.
* @param dataset The input dataset.
* @param config The configuration.
* @param other The optional props.
*
* @internal
*/
function _addIssue(context, label, dataset, config$1, other) {
	const input = other && "input" in other ? other.input : dataset.value;
	const expected = other?.expected ?? context.expects ?? null;
	const received = other?.received ?? /* @__PURE__ */ _stringify(input);
	const issue = {
		kind: context.kind,
		type: context.type,
		input,
		expected,
		received,
		message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
		requirement: context.requirement,
		path: other?.path,
		issues: other?.issues,
		lang: config$1.lang,
		abortEarly: config$1.abortEarly,
		abortPipeEarly: config$1.abortPipeEarly
	};
	const isSchema = context.kind === "schema";
	const message$1 = other?.message ?? context.message ?? (context.reference, issue.lang, void 0) ?? (isSchema ? (issue.lang, void 0) : null) ?? config$1.message ?? (issue.lang, void 0);
	if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
	if (isSchema) dataset.typed = false;
	if (dataset.issues) dataset.issues.push(issue);
	else dataset.issues = [issue];
}
/**
* Joins multiple `expects` values with the given separator.
*
* @param values The `expects` values.
* @param separator The separator.
*
* @returns The joined `expects` property.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _joinExpects(values$1, separator) {
	const list = [...new Set(values$1)];
	if (list.length > 1) return `(${list.join(` ${separator} `)})`;
	return list[0] ?? "never";
}
/**
* Eagerly creates and attaches the Standard Schema properties of a schema.
*
* Hint: The contextual `this` type includes the standard properties that are
* attached before the schema is returned.
*
* @param schema The schema to attach standard properties to.
*
* @returns The schema with standard properties attached.
*
* @internal
*/
function _standardSchema(schema) {
	schema["~standard"] = {
		version: 1,
		vendor: "valibot",
		validate: (value$1) => schema["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig())
	};
	return schema;
}
/**
* A Valibot error with useful information.
*/
var ValiError = class extends Error {
	/**
	* Creates a Valibot error with useful information.
	*
	* @param issues The error issues.
	*/
	constructor(issues) {
		super(issues[0].message);
		this.name = "ValiError";
		this.issues = issues;
	}
};
/**
* Returns the fallback value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The output dataset if available.
* @param config The config if available.
*
* @returns The fallback value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getFallback(schema, dataset, config$1) {
	return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
/**
* Returns the default value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The input dataset if available.
* @param config The config if available.
*
* @returns The default value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getDefault(schema, dataset, config$1) {
	return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
/* @__NO_SIDE_EFFECTS__ */
function array(item, message$1) {
	return _standardSchema({
		kind: "schema",
		type: "array",
		reference: array,
		expects: "Array",
		async: false,
		item,
		message: message$1,
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (Array.isArray(input)) {
				dataset.typed = true;
				dataset.value = [];
				for (let key = 0; key < input.length; key++) {
					const value$1 = input[key];
					const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
					if (itemDataset.issues) {
						const pathItem = {
							type: "array",
							origin: "value",
							input,
							key,
							value: value$1
						};
						for (const issue of itemDataset.issues) {
							if (issue.path) issue.path.unshift(pathItem);
							else issue.path = [pathItem];
							dataset.issues?.push(issue);
						}
						if (!dataset.issues) dataset.issues = itemDataset.issues;
						if (config$1.abortEarly) {
							dataset.typed = false;
							break;
						}
					}
					if (!itemDataset.typed) dataset.typed = false;
					dataset.value.push(itemDataset.value);
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	});
}
/* @__NO_SIDE_EFFECTS__ */
function number(message$1) {
	return _standardSchema({
		kind: "schema",
		type: "number",
		reference: number,
		expects: "number",
		async: false,
		message: message$1,
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	});
}
/* @__NO_SIDE_EFFECTS__ */
function object(entries$1, message$1) {
	return _standardSchema({
		kind: "schema",
		type: "object",
		reference: object,
		expects: "Object",
		async: false,
		entries: entries$1,
		message: message$1,
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (input && typeof input === "object") {
				dataset.typed = true;
				dataset.value = {};
				for (const key in this.entries) {
					const valueSchema = this.entries[key];
					if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
						const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
						const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
						if (valueDataset.issues) {
							const pathItem = {
								type: "object",
								origin: "value",
								input,
								key,
								value: value$1
							};
							for (const issue of valueDataset.issues) {
								if (issue.path) issue.path.unshift(pathItem);
								else issue.path = [pathItem];
								dataset.issues?.push(issue);
							}
							if (!dataset.issues) dataset.issues = valueDataset.issues;
							if (config$1.abortEarly) {
								dataset.typed = false;
								break;
							}
						}
						if (!valueDataset.typed) dataset.typed = false;
						dataset.value[key] = valueDataset.value;
					} else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
					else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
						_addIssue(this, "key", dataset, config$1, {
							input: void 0,
							expected: `"${key}"`,
							path: [{
								type: "object",
								origin: "key",
								input,
								key,
								value: input[key]
							}]
						});
						if (config$1.abortEarly) break;
					}
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	});
}
/* @__NO_SIDE_EFFECTS__ */
function optional(wrapped, default_) {
	return _standardSchema({
		kind: "schema",
		type: "optional",
		reference: optional,
		expects: `(${wrapped.expects} | undefined)`,
		async: false,
		wrapped,
		default: default_,
		"~run"(dataset, config$1) {
			if (dataset.value === void 0) {
				if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
				if (dataset.value === void 0) {
					dataset.typed = true;
					return dataset;
				}
			}
			return this.wrapped["~run"](dataset, config$1);
		}
	});
}
/* @__NO_SIDE_EFFECTS__ */
function picklist(options, message$1) {
	return _standardSchema({
		kind: "schema",
		type: "picklist",
		reference: picklist,
		expects: /* @__PURE__ */ _joinExpects(options.map(_stringify), "|"),
		async: false,
		options,
		message: message$1,
		"~run"(dataset, config$1) {
			if (this.options.includes(dataset.value)) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	});
}
/* @__NO_SIDE_EFFECTS__ */
function string(message$1) {
	return _standardSchema({
		kind: "schema",
		type: "string",
		reference: string,
		expects: "string",
		async: false,
		message: message$1,
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "string") dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	});
}
/**
* Creates a unknown schema.
*
* @returns A unknown schema.
*/
/* @__NO_SIDE_EFFECTS__ */
function unknown() {
	return _standardSchema({
		kind: "schema",
		type: "unknown",
		reference: unknown,
		expects: "unknown",
		async: false,
		"~run"(dataset) {
			dataset.typed = true;
			return dataset;
		}
	});
}
/**
* Parses an unknown input based on a schema.
*
* @param schema The schema to be used.
* @param input The input to be parsed.
* @param config The parse configuration.
*
* @returns The parsed input.
*/
function parse(schema, input, config$1) {
	const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config$1));
	if (dataset.issues) throw new ValiError(dataset.issues);
	return dataset.value;
}
//#endregion
//#region src/changes.ts
const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u;
/** Keeps file-wide diagnostics and diagnostics whose location intersects a changed line. */
function filterToChangedLines(diagnostics, changedLines, toRepositoryPath) {
	return diagnostics.filter((diagnostic) => {
		const ranges = changedLines.get(toRepositoryPath(diagnostic.filePath));
		if (ranges === void 0) return false;
		if (ranges === "all" || diagnostic.loc === void 0) return true;
		const startLine = diagnostic.loc.start.line;
		const endLine = diagnostic.loc.end?.line ?? startLine;
		return ranges.some((range) => startLine <= range.endLine && endLine >= range.startLine);
	});
}
/** Reads the new-file line ranges from the hunk headers of a unified diff. */
function parsePatch(patch) {
	const ranges = [];
	for (const line of patch.split("\n")) {
		const match = hunkHeader.exec(line);
		if (match === null) continue;
		const startLine = Number(match[1]);
		const count = match[2] === void 0 ? 1 : Number(match[2]);
		if (count > 0) ranges.push({
			endLine: startLine + count - 1,
			startLine
		});
	}
	return ranges;
}
function toChangedLines(files) {
	return new Map(files.filter((file) => file.status !== "removed").map((file) => [file.filename, file.patch === void 0 ? "all" : parsePatch(file.patch)]));
}
//#endregion
//#region src/findings.ts
/** Identifies the summary comment so that later runs rewrite it instead of adding another one. */
const summaryMarker = "<!-- alint-summary -->";
const suggestionParagraph = /\n\s*Suggestion:/u;
const maxSummaryRows = 100;
function formatSummary(findings, context) {
	const icon = toConclusion(findings) === "failure" ? "❌" : findings.length > 0 ? "⚠️" : "✅";
	const shortSha = context.sha.slice(0, 7);
	const lines = [
		summaryMarker,
		`### ${icon} alint · ${formatTitle(findings)}`,
		""
	];
	if (findings.length === 0) lines.push(`Checked the changes at \`${shortSha}\`.`);
	else {
		lines.push("| | Location | Rule | Finding |", "| --- | --- | --- | --- |");
		for (const finding of findings.slice(0, maxSummaryRows)) {
			const link = `${context.serverUrl}/${context.repository}/blob/${context.sha}/${encodeURI(finding.path)}#L${finding.line}`;
			const detail = finding.suggestion === void 0 ? escapeCell(finding.message) : `${escapeCell(finding.message)}<br><sub>💡 ${escapeCell(finding.suggestion)}</sub>`;
			lines.push(`| ${finding.severity === "error" ? "❌" : "⚠️"} | [\`${finding.path}:${finding.line}\`](${link}) | \`${finding.ruleId}\` | ${detail} |`);
		}
		if (findings.length > maxSummaryRows) lines.push("", `${findings.length - maxSummaryRows} more findings are in the check annotations.`);
	}
	const footer = [
		`Commit \`${shortSha}\``,
		context.runUrl === void 0 ? void 0 : `[run](${context.runUrl})`,
		context.usage
	].filter((part) => part !== void 0);
	lines.push("", `<sub>${footer.join(" · ")}</sub>`);
	return lines.join("\n");
}
function formatTitle(findings) {
	if (findings.length === 0) return "No findings";
	const errors = findings.filter((finding) => finding.severity === "error").length;
	const warnings = findings.length - errors;
	return [errors > 0 ? pluralize(errors, "error") : void 0, warnings > 0 ? pluralize(warnings, "warning") : void 0].filter((part) => part !== void 0).join(", ");
}
/** States the cost of a run, so that a reader can see from the check run whether the cache works. */
function formatUsage(result) {
	const tokens = `${result.usage.inputTokens.toLocaleString("en-US")} input / ${result.usage.outputTokens.toLocaleString("en-US")} output tokens`;
	return result.execution === void 0 ? tokens : `${pluralize(result.execution.completed, "rule run")}, ${result.execution.cached} cached · ${tokens}`;
}
function toAnnotations(findings) {
	return findings.map((finding) => ({
		annotation_level: finding.severity === "error" ? "failure" : "warning",
		end_line: finding.line,
		message: finding.suggestion === void 0 ? finding.message : `${finding.message}\n\n${finding.suggestion}`,
		path: finding.path,
		start_line: finding.line,
		title: finding.ruleId
	}));
}
function toConclusion(findings) {
	if (findings.some((finding) => finding.severity === "error")) return "failure";
	return findings.length > 0 ? "neutral" : "success";
}
/** Converts diagnostics to findings with repository-relative paths. Errors come first. */
function toFindings(diagnostics, toRepositoryPath) {
	return diagnostics.map((diagnostic) => {
		const [message = "", ...paragraphs] = diagnostic.message.split(suggestionParagraph);
		return {
			line: diagnostic.loc?.start.line ?? 1,
			message: message.trim(),
			path: toRepositoryPath(diagnostic.filePath),
			ruleId: diagnostic.ruleId,
			severity: diagnostic.severity,
			suggestion: suggestionFrom(diagnostic.evidence) ?? (paragraphs.join("\n").trim() || void 0)
		};
	}).sort((a, b) => Number(b.severity === "error") - Number(a.severity === "error") || a.path.localeCompare(b.path) || a.line - b.line);
}
function escapeCell(value) {
	return value.replaceAll("|", "\\|").replaceAll(/\s*\n\s*/gu, " ");
}
function pluralize(count, noun) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
function suggestionFrom(evidence) {
	if (typeof evidence !== "object" || evidence === null || !("suggestion" in evidence) || typeof evidence.suggestion !== "string") return;
	return evidence.suggestion.trim() || void 0;
}
//#endregion
//#region src/github.ts
const annotationsPerRequest = 50;
const itemsPerPage = 100;
const checkRunSchema = /* @__PURE__ */ object({ id: /* @__PURE__ */ number() });
const commentsSchema = /* @__PURE__ */ array(/* @__PURE__ */ object({
	body: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	id: /* @__PURE__ */ number()
}));
const filesSchema = /* @__PURE__ */ array(/* @__PURE__ */ object({
	filename: /* @__PURE__ */ string(),
	patch: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	status: /* @__PURE__ */ string()
}));
const comparisonSchema = /* @__PURE__ */ object({ files: filesSchema });
/** Lists the files that differ between two commits. GitHub returns at most 300 files here. */
async function listComparedFiles(repository, base, head) {
	return parse(comparisonSchema, await request(repository, "GET", `/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`)).files;
}
async function listPullRequestFiles(repository, pullRequest) {
	const files = [];
	for (let page = 1;; page += 1) {
		const items = parse(filesSchema, await request(repository, "GET", `/pulls/${pullRequest}/files?per_page=${itemsPerPage}&page=${page}`));
		files.push(...items);
		if (items.length < itemsPerPage) return files;
	}
}
async function publishCheckRun(repository, checkRun) {
	const output = {
		summary: checkRun.summary,
		title: checkRun.title
	};
	const created = parse(checkRunSchema, await request(repository, "POST", "/check-runs", {
		conclusion: checkRun.conclusion,
		head_sha: checkRun.sha,
		name: checkRun.name,
		output: {
			...output,
			annotations: checkRun.annotations.slice(0, annotationsPerRequest)
		},
		status: "completed"
	}));
	for (let offset = annotationsPerRequest; offset < checkRun.annotations.length; offset += annotationsPerRequest) await request(repository, "PATCH", `/check-runs/${created.id}`, { output: {
		...output,
		annotations: checkRun.annotations.slice(offset, offset + annotationsPerRequest)
	} });
}
/**
* Rewrites the summary comment of a pull request.
*
* A pull request that never had findings gets no comment. After the first comment exists,
* each run rewrites it, so a fixed pull request shows the clean result.
*/
async function publishSummaryComment(repository, pullRequest, body, hasFindings) {
	const existing = await findSummaryComment(repository, pullRequest);
	if (existing !== void 0) {
		await request(repository, "PATCH", `/issues/comments/${existing}`, { body });
		return;
	}
	if (hasFindings) await request(repository, "POST", `/issues/${pullRequest}/comments`, { body });
}
async function findSummaryComment(repository, pullRequest) {
	for (let page = 1;; page += 1) {
		const comments = parse(commentsSchema, await request(repository, "GET", `/issues/${pullRequest}/comments?per_page=${itemsPerPage}&page=${page}`));
		const summary = comments.find((comment) => comment.body?.includes(summaryMarker));
		if (summary !== void 0) return summary.id;
		if (comments.length < itemsPerPage) return;
	}
}
async function request(repository, method, path, body) {
	const response = await fetch(`${repository.apiUrl}/repos/${repository.repository}${path}`, {
		body: body === void 0 ? void 0 : JSON.stringify(body),
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${repository.token}`,
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28"
		},
		method
	});
	if (!response.ok) throw new Error(`GitHub ${method} ${path} failed with ${response.status}: ${await response.text()}`);
	return response.json();
}
//#endregion
//#region node_modules/.pnpm/tinyexec@1.3.1/node_modules/tinyexec/dist/main.mjs
const isPathLikePattern = /^path$/i;
const defaultEnvPathInfo = {
	key: "PATH",
	value: ""
};
function getPathFromEnv(env) {
	for (const key in env) {
		if (!Object.prototype.hasOwnProperty.call(env, key) || !isPathLikePattern.test(key)) continue;
		const value = env[key];
		if (!value) return defaultEnvPathInfo;
		return {
			key,
			value
		};
	}
	return defaultEnvPathInfo;
}
function addNodeBinToPath(cwd, path) {
	const parts = path.value.split(delimiter);
	const nodeBinPaths = [];
	let currentPath = typeof cwd === "string" ? cwd : fileURLToPath(cwd, { windows: false });
	let lastPath;
	do {
		nodeBinPaths.push(resolve(currentPath, "node_modules", ".bin"));
		lastPath = currentPath;
		currentPath = dirname(currentPath);
	} while (currentPath !== lastPath);
	nodeBinPaths.push(dirname(process.execPath));
	const newPath = nodeBinPaths.concat(parts).join(delimiter);
	return {
		key: path.key,
		value: newPath
	};
}
function computeEnv(cwd, env, nodePath = true) {
	const envWithDefault = {
		...process.env,
		...env
	};
	if (!nodePath) return envWithDefault;
	const envPathInfo = addNodeBinToPath(cwd, getPathFromEnv(envWithDefault));
	envWithDefault[envPathInfo.key] = envPathInfo.value;
	return envWithDefault;
}
const combineStreams = (streams) => {
	let streamCount = streams.length;
	const combined = new PassThrough();
	const maybeEmitEnd = () => {
		if (--streamCount === 0) combined.end();
	};
	for (const stream of streams) pipeline(stream, combined, { end: false }).then(maybeEmitEnd).catch(maybeEmitEnd);
	return combined;
};
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
const shebangRegExp = /^#!\s*(.+)/;
const isWindowsExecutableRegExp = /\.(?:com|exe)$/i;
const isNodeModulesCmdRegExp = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;
const isWindows = process.platform === "win32";
const defaultPathExt = [
	".EXE",
	".CMD",
	".BAT",
	".COM"
];
const noPathExt = [""];
/**
* Normalizes the command and arguments to work cross-platform.
* On Windows, this basically handles things like shebangs, calling
* `node_modules/.bin` commands, and escaping meta characters.
* On other platforms, it just returns the command and arguments as-is.
*/
function normalizeSpawnCommand(command, args = [], options = {}) {
	if (options.shell === true || !isWindows) return {
		command,
		args,
		options
	};
	let file = resolveCommand(command, options);
	let shebang = null;
	if (file !== null) {
		const size = 150;
		const buffer = Buffer.alloc(size);
		let fd = null;
		try {
			fd = openSync(file, "r");
			readSync(fd, buffer, 0, size, 0);
		} catch {} finally {
			if (fd !== null) closeSync(fd);
		}
		const match = buffer.toString().match(shebangRegExp);
		if (match !== null) {
			const line = match[1].trim();
			const separatorIndex = line.indexOf(" ");
			const path = separatorIndex !== -1 ? line.slice(0, separatorIndex) : line;
			const argument = separatorIndex !== -1 ? line.slice(separatorIndex + 1) : "";
			const binary = basename(path);
			shebang = binary === "env" ? argument || null : binary;
		}
	}
	if (shebang !== null && file !== null) {
		args = [file, ...args];
		command = shebang;
		file = resolveCommand(command, options);
	}
	if (file === null || !isWindowsExecutableRegExp.test(file)) {
		const needsDoubleEscapeMetaChars = file !== null && isNodeModulesCmdRegExp.test(file);
		command = normalize(command);
		command = command.replace(metaCharsRegExp, "^$1");
		args = args.map((arg) => {
			arg = arg.replace(/(?=(\\+?)?)\1"/g, "$1$1\\\"");
			arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
			arg = `"${arg}"`;
			arg = arg.replace(metaCharsRegExp, "^$1");
			if (needsDoubleEscapeMetaChars) arg = arg.replace(metaCharsRegExp, "^$1");
			return arg;
		});
		args = [
			"/d",
			"/s",
			"/c",
			`"${[command, ...args].join(" ")}"`
		];
		command = options.env?.comspec ?? "cmd.exe";
		options = {
			...options,
			windowsVerbatimArguments: true
		};
	}
	return {
		command,
		args,
		options
	};
}
/**
* Resolves the command to an absolute path if possible.
* Handles things like traversing PATH and adding extensions from PATHEXT
*/
function resolveCommand(command, options) {
	const cwd$3 = (options.cwd ?? cwd()).toString();
	const env = options.env ?? process.env;
	const PATH = getPathFromEnv(env).value;
	const pathEnv = command.includes("/") || command.includes("\\") ? [""] : [cwd$3, ...PATH.split(delimiter)];
	let pathExt = env.PATHEXT ? env.PATHEXT.split(delimiter) : defaultPathExt;
	if (command.includes(".") && pathExt[0] !== "") pathExt = ["", ...pathExt];
	for (const extensions of [pathExt, noPathExt]) for (const path of pathEnv) {
		const unquoted = path.startsWith("\"") && path.endsWith("\"") && path.length > 1 ? path.slice(1, -1) : path;
		const dest = resolve(cwd$3, unquoted, command);
		for (const ext of extensions) {
			const destWithExt = dest + ext;
			try {
				if (statSync(destWithExt).isFile()) return destWithExt;
			} catch {}
		}
	}
	return null;
}
var NonZeroExitError = class extends Error {
	result;
	output;
	exitCode;
	get signalCode() {
		return this.result.signalCode;
	}
	constructor(result, output, command, args) {
		let target = "The process";
		if (command) target = `The command \`${args?.length ? `${command} ${args.map((a) => /[ "'`()]/.test(a) ? JSON.stringify(a) : a).join(" ")}` : command}\``;
		const exitCode = result.exitCode ?? 1;
		super(result.signalCode !== null ? `${target} was killed by the signal ${result.signalCode}` : `${target} exited with a non-zero status (${exitCode})`);
		this.result = result;
		this.output = output;
		this.exitCode = exitCode;
		Object.defineProperty(this, "result", {
			enumerable: false,
			writable: false,
			configurable: false
		});
	}
};
const defaultOptions = {
	timeout: void 0,
	persist: false
};
const defaultNodeOptions = { windowsHide: true };
function combineSignals(signals) {
	const controller = new AbortController();
	for (const signal of signals) {
		if (signal.aborted) {
			controller.abort();
			return signal;
		}
		const onAbort = () => {
			controller.abort(signal.reason);
		};
		signal.addEventListener("abort", onAbort, { signal: controller.signal });
	}
	return controller.signal;
}
async function readStream(stream) {
	let output = "";
	try {
		for await (const chunk of stream) output += chunk.toString();
	} catch {}
	return output;
}
var ExecProcess = class {
	_process;
	_aborted = false;
	_options;
	_command;
	_args;
	_resolveClose;
	_processClosed;
	_thrownError;
	get process() {
		return this._process;
	}
	get pid() {
		return this._process?.pid;
	}
	get exitCode() {
		if (this._process && this._process.exitCode !== null) return this._process.exitCode;
	}
	get signalCode() {
		return this._process?.signalCode ?? null;
	}
	constructor(command, args, options) {
		this._options = {
			...defaultOptions,
			...options
		};
		this._command = command;
		this._args = args ?? [];
		this._processClosed = new Promise((resolve) => {
			this._resolveClose = resolve;
		});
	}
	kill(signal) {
		return this._process?.kill(signal) === true;
	}
	get aborted() {
		return this._aborted;
	}
	get killed() {
		return this._process?.killed === true;
	}
	pipe(command, args, options) {
		return exec(command, args, {
			...options,
			stdin: this
		});
	}
	async *[Symbol.asyncIterator]() {
		const proc = this._process;
		if (!proc) return;
		const streams = [];
		if (this._streamErr) streams.push(this._streamErr);
		if (this._streamOut) streams.push(this._streamOut);
		const streamCombined = combineStreams(streams);
		const rl = readline.createInterface({ input: streamCombined });
		for await (const chunk of rl) yield chunk.toString();
		await this._processClosed;
		proc.removeAllListeners();
		if (this._thrownError) throw this._thrownError;
		if (this._options?.throwOnError && (this.exitCode !== 0 && this.exitCode !== void 0 || this.signalCode !== null)) throw new NonZeroExitError(this, void 0, this._command, this._args);
	}
	async _waitForOutput() {
		const proc = this._process;
		if (!proc) throw new Error("No process was started");
		const [stdout, stderr] = await Promise.all([this._streamOut ? readStream(this._streamOut) : "", this._streamErr ? readStream(this._streamErr) : ""]);
		await this._processClosed;
		const { stdin } = this._options;
		if (stdin && typeof stdin !== "string") await stdin;
		proc.removeAllListeners();
		if (this._thrownError) throw this._thrownError;
		const result = {
			stderr,
			stdout,
			exitCode: this.exitCode
		};
		if (this._options.throwOnError && (this.exitCode !== 0 && this.exitCode !== void 0 || this.signalCode !== null)) throw new NonZeroExitError(this, result, this._command, this._args);
		return result;
	}
	then(onfulfilled, onrejected) {
		return this._waitForOutput().then(onfulfilled, onrejected);
	}
	_streamOut;
	_streamErr;
	spawn() {
		const options = this._options;
		const nodeOptions = {
			...defaultNodeOptions,
			...options.nodeOptions
		};
		const cwd$1 = nodeOptions?.cwd ?? cwd();
		const signals = [];
		this._resetState();
		if (options.timeout !== void 0) signals.push(AbortSignal.timeout(options.timeout));
		if (options.signal !== void 0) signals.push(options.signal);
		if (options.persist === true) nodeOptions.detached = true;
		if (signals.length > 0) nodeOptions.signal = combineSignals(signals);
		nodeOptions.env = computeEnv(cwd$1, nodeOptions.env, options.nodePath);
		const crossResult = normalizeSpawnCommand(this._command, this._args, nodeOptions);
		const handle = spawn(crossResult.command, crossResult.args, crossResult.options);
		if (handle.stderr) this._streamErr = handle.stderr;
		if (handle.stdout) this._streamOut = handle.stdout;
		this._process = handle;
		handle.once("error", this._onError);
		handle.once("close", this._onClose);
		if (handle.stdin) {
			const { stdin } = options;
			if (typeof stdin === "string") handle.stdin.end(stdin);
			else stdin?.process?.stdout?.pipe(handle.stdin);
		}
	}
	_resetState() {
		this._aborted = false;
		this._processClosed = new Promise((resolve) => {
			this._resolveClose = resolve;
		});
		this._thrownError = void 0;
	}
	_onError = (err) => {
		if (err.name === "AbortError" && (!(err.cause instanceof Error) || err.cause.name !== "TimeoutError")) {
			this._aborted = true;
			return;
		}
		this._thrownError = err;
	};
	_onClose = () => {
		if (this._resolveClose) this._resolveClose();
	};
};
const x = (command, args, userOptions) => {
	const proc = new ExecProcess(command, args, userOptions);
	proc.spawn();
	return proc;
};
const exec = x;
//#endregion
//#region src/output.ts
const positionSchema = /* @__PURE__ */ object({
	column: /* @__PURE__ */ number(),
	line: /* @__PURE__ */ number()
});
const runResultSchema = /* @__PURE__ */ object({
	diagnostics: /* @__PURE__ */ array(/* @__PURE__ */ object({
		evidence: /* @__PURE__ */ optional(/* @__PURE__ */ unknown()),
		filePath: /* @__PURE__ */ string(),
		loc: /* @__PURE__ */ optional(/* @__PURE__ */ object({
			end: /* @__PURE__ */ optional(positionSchema),
			start: positionSchema
		})),
		message: /* @__PURE__ */ string(),
		ruleId: /* @__PURE__ */ string(),
		severity: /* @__PURE__ */ picklist(["error", "warn"])
	})),
	execution: /* @__PURE__ */ optional(/* @__PURE__ */ object({
		cached: /* @__PURE__ */ number(),
		completed: /* @__PURE__ */ number()
	})),
	usage: /* @__PURE__ */ object({
		inputTokens: /* @__PURE__ */ number(),
		outputTokens: /* @__PURE__ */ number()
	})
});
function parseRunResult(json) {
	return parse(runResultSchema, JSON.parse(json));
}
//#endregion
//#region src/lint.ts
/** Runs `alint --format json` on the targets and returns the parsed result. */
async function runAlint(command, targets, cwd) {
	const result = await x(command, [
		"--format",
		"json",
		...targets
	], { nodeOptions: { cwd } });
	if (result.exitCode !== 0 && result.exitCode !== 1) throw new Error(`alint exited with code ${result.exitCode}.\n${result.stderr || result.stdout}`);
	return parseRunResult(result.stdout);
}
//#endregion
//#region src/main.ts
const eventSchema = /* @__PURE__ */ object({
	after: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	before: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	pull_request: /* @__PURE__ */ optional(/* @__PURE__ */ object({
		head: /* @__PURE__ */ object({ sha: /* @__PURE__ */ string() }),
		number: /* @__PURE__ */ number()
	})),
	repository: /* @__PURE__ */ optional(/* @__PURE__ */ object({ default_branch: /* @__PURE__ */ string() }))
});
const zeroCommit = /^0+$/u;
async function run(env, cwd) {
	const repository = {
		apiUrl: env.GITHUB_API_URL ?? "https://api.github.com",
		repository: required(env, "GITHUB_REPOSITORY"),
		token: required(env, "GITHUB_TOKEN")
	};
	const workspace = env.GITHUB_WORKSPACE ?? cwd;
	const serverUrl = env.GITHUB_SERVER_URL ?? "https://github.com";
	const event = await readEvent(env.GITHUB_EVENT_PATH);
	const pullRequest = event.pull_request;
	const sha = pullRequest?.head.sha ?? required(env, "GITHUB_SHA");
	const toRepositoryPath = (filePath) => relative(workspace, resolve$1(cwd, filePath));
	const scope = await resolveScope(repository, event, env.INPUT_FILES ?? "", cwd, workspace);
	const result = scope.targets.length === 0 ? {
		diagnostics: [],
		usage: {
			inputTokens: 0,
			outputTokens: 0
		}
	} : await runAlint(required(env, "ALINT_COMMAND"), scope.targets, cwd);
	const findings = toFindings(scope.changedLines === void 0 ? result.diagnostics : filterToChangedLines(result.diagnostics, scope.changedLines, toRepositoryPath), toRepositoryPath);
	const title = formatTitle(findings);
	const summary = formatSummary(findings, {
		repository: repository.repository,
		runUrl: env.GITHUB_RUN_ID === void 0 ? void 0 : `${serverUrl}/${repository.repository}/actions/runs/${env.GITHUB_RUN_ID}`,
		serverUrl,
		sha,
		usage: formatUsage(result)
	});
	if (env.GITHUB_STEP_SUMMARY !== void 0) await appendFile(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
	if (env.GITHUB_OUTPUT !== void 0) {
		const errors = findings.filter((finding) => finding.severity === "error").length;
		await appendFile(env.GITHUB_OUTPUT, `errors=${errors}\nwarnings=${findings.length - errors}\n`);
	}
	await publishCheckRun(repository, {
		annotations: toAnnotations(findings),
		conclusion: toConclusion(findings),
		name: env.INPUT_CHECK_NAME || "alint",
		sha,
		summary,
		title
	});
	if (pullRequest !== void 0) await publishSummaryComment(repository, pullRequest.number, summary, findings.length > 0);
	console.info(`Published ${title.toLowerCase()} to ${repository.repository}@${sha.slice(0, 7)}.`);
}
/** Lists the files that the event changed. `undefined` means that the event has no changes, for example a manual run. */
async function listChangedFiles(repository, event) {
	if (event.pull_request !== void 0) return listPullRequestFiles(repository, event.pull_request.number);
	if (event.before === void 0 || event.after === void 0) return;
	if (zeroCommit.test(event.after)) return [];
	const base = zeroCommit.test(event.before) ? event.repository?.default_branch : event.before;
	return base === void 0 ? void 0 : listComparedFiles(repository, base, event.after);
}
async function readEvent(eventPath) {
	return eventPath === void 0 ? {} : parse(eventSchema, JSON.parse(await readFile(eventPath, "utf8")));
}
function required(env, name) {
	const value = env[name];
	if (!value) throw new Error(`${name} is not set.`);
	return value;
}
/**
* Selects what alint reads.
*
* Explicit files win. A pull request or a push without explicit files gets its changed files,
* and the result keeps only the changed lines. Other events get the whole working directory.
*/
async function resolveScope(repository, event, files, cwd, workspace) {
	const explicit = files.split(/\s+/u).filter(Boolean);
	if (explicit.length > 0) return { targets: explicit };
	const changedFiles = await listChangedFiles(repository, event);
	if (changedFiles === void 0) return { targets: ["."] };
	const changedLines = toChangedLines(changedFiles);
	return {
		changedLines,
		targets: [...changedLines.keys()].map((path) => relative(cwd, resolve$1(workspace, path))).filter((path) => !path.startsWith("..") && existsSync(resolve$1(cwd, path)))
	};
}
//#endregion
//#region src/index.ts
run(process$1.env, process$1.cwd()).catch((error) => {
	console.error(`::error title=alint::${(errorMessageFrom(error) ?? "unknown error").replaceAll("\n", "%0A")}`);
	process$1.exitCode = 1;
});
//#endregion
export {};
