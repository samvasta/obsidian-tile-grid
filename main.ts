import { MarkdownPostProcessorContext, Plugin } from "obsidian";

type GridRow = {
	cellContents: string[];
};

// Remember to rename these classes and interfaces!

interface TileGridPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: TileGridPluginSettings = {
	mySetting: "default",
};

export default class TileGridPlugin extends Plugin {
	settings: TileGridPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor("tiles", this.postprocessor);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async postprocessor(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	) {
		try {
			const [definitions, grid] = source.split("===");
			const tokenToSrc: Map<string, string> = new Map<string, string>();

			if (!definitions) {
				throw new Error(
					"You're missing the definitions section. Definitions and grid sections should be split with '==='"
				);
			}
			if (!grid) {
				throw new Error(
					"You're missing the grid section. Definitions and grid sections should be split with '==='"
				);
			}

			definitions
				.split("\n")
				.filter((line) => line.trim().length > 1)
				.forEach((line, index) => {
					const idx = line.indexOf("=");
					const token = line.substring(0, idx);
					const src = line.substring(idx + 1);

					if (!token || !src) {
						throw new Error(
							`Could not parse definition at line ${
								index + 1
							} (${line}). The format is '{{token}}={{content or url}}'`
						);
					}
					tokenToSrc.set(token, src);
				});

			let maxWidth = 0;
			const rows: GridRow[] = [];
			grid.trim()
				.split("\n")
				.forEach((line) => {
					const row: GridRow = {
						cellContents: [] as string[],
					};
					maxWidth = Math.max(maxWidth, line.length);

					for (const char of line) {
						row.cellContents.push(tokenToSrc.get(char) || "");
					}
					rows.push(row);
				});

			const container = el.createEl("div");
			container.addClass("tilegrid", "container");
			container.style.gridTemplateColumns = "1fr "
				.repeat(maxWidth)
				.trim();

			rows.forEach((row, rowIdx) => {
				for (let colIdx = 0; colIdx < maxWidth; colIdx++) {
					const content =
						colIdx < row.cellContents.length
							? row.cellContents[colIdx]
							: "";

					const cellEl = container.createDiv();
					cellEl.addClass(
						"tilegrid",
						"cell",
						(rowIdx + colIdx) % 2 === 0 ? "light" : "dark"
					);
					cellEl.style.setProperty(
						"grid-column-start",
						(colIdx + 1).toString()
					);
					cellEl.style.setProperty(
						"grid-column-end",
						(colIdx + 1).toString()
					);
					cellEl.style.setProperty(
						"grid-row-start",
						(rowIdx + 1).toString()
					);
					cellEl.style.setProperty(
						"grid-row-end",
						(rowIdx + 1).toString()
					);
					const emojiUnicode = getEmojiUnicode(content);
					if (emojiUnicode) {
						const imageEl = cellEl.createEl("img");
						imageEl.addClass("tilegrid");
						imageEl.src = `https://twitter.github.io/twemoji/v/13.1.0/svg/${emojiUnicode}.svg`;
					} else if (content.startsWith("http")) {
						const imageEl = cellEl.createEl("img");
						imageEl.addClass("tilegrid");
						imageEl.src = content;
					} else {
						cellEl.setText(content);
					}
				}
			});
		} catch (e) {
			console.error(`Obsidian Tile Grid Error:\n${e}`);
			const pre = createEl("pre");
			pre.setText(`\`\`\`tiles
There was an error rendering the tiles:
${e.stack
	.split("\n")
	.filter((line: string) => !/^at/.test(line?.trim()))
	.join("\n")}
\`\`\``);
		}
	}
}

function getEmojiUnicode(input: string) {
	const raw = (input: string) => {
		if (input.length === 1) {
			return input.charCodeAt(0).toString();
		} else if (input.length > 1) {
			const pairs = [];
			for (let i = 0; i < input.length; i++) {
				if (
					// high surrogate
					input.charCodeAt(i) >= 0xd800 &&
					input.charCodeAt(i) <= 0xdbff
				) {
					if (
						input.charCodeAt(i + 1) >= 0xdc00 &&
						input.charCodeAt(i + 1) <= 0xdfff
					) {
						// low surrogate
						pairs.push(
							(input.charCodeAt(i) - 0xd800) * 0x400 +
								(input.charCodeAt(i + 1) - 0xdc00) +
								0x10000
						);
					}
				} else if (
					input.charCodeAt(i) < 0xd800 ||
					input.charCodeAt(i) > 0xdfff
				) {
					// modifiers and joiners
					pairs.push(input.charCodeAt(i));
				}
			}
			return pairs.join(" ");
		}

		return "";
	};

	if (!input.match(/\p{Emoji}/u)) {
		return undefined;
	}

	return raw(input)
		.split(" ")
		.map((val: string) => parseInt(val).toString(16))
		.join(" ");
}
