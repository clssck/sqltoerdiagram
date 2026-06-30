import { createInterface } from 'node:readline/promises';

export async function chooseFromList(items, options = {}) {
	const {
		message = 'Choose an item:',
		formatItem = item => String(item),
		input = process.stdin,
		output = process.stdout
	} = options;

	if (!Array.isArray(items) || items.length === 0) {
		throw new Error('No choices available.');
	}

	if (items.length === 1) {
		return items[0];
	}

	output.write(`${message}\n`);
	items.forEach((item, index) => {
		output.write(`${index + 1}. ${formatItem(item)}\n`);
	});

	const rl = createInterface({ input, output });
	try {
		while (true) {
			const answer = (await rl.question(`Select 1-${items.length}: `)).trim();
			const selected = Number.parseInt(answer, 10);
			if (Number.isInteger(selected) && selected >= 1 && selected <= items.length) {
				return items[selected - 1];
			}
			output.write(`Enter a number from 1 to ${items.length}.\n`);
		}
	} finally {
		rl.close();
	}
}

export function formatRepo(repo) {
	const tag = repo.hasDbt ? '[dbt] ' : '';
	return `${tag}${repo.nameWithOwner}`;
}
