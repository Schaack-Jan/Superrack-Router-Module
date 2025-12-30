const superrackMidiMap = JSON.stringify(require('./superrack-midi-map.json'))

const getEmptyTemplate = (rackCount) => {
	let racks = []
	for (let rack = 1; rack <= rackCount; rack++) {
		racks[rack] = {
			id: rack,
			value: null,
		}
	}
	return racks
}

const getHotPluginMapping = () => {
	return [
		null,
		{ id: 1, value: 1 },
		{ id: 2, value: 2 },
		{ id: 3, value: 3 },
		{ id: 4, value: 4 },
		{ id: 5, value: 5 },
		{ id: 6, value: 6 },
		{ id: 7, value: 7 },
		{ id: 8, value: 8 },
		{ id: 9, value: 9 },
		{ id: 10, value: 10 },
		{ id: 11, value: 11 },
		{ id: 12, value: 12 },
	]
}

const getHotSnapshotMapping = () => {
	return [
		null,
		{ id: 1, value: 1 },
		{ id: 2, value: 2 },
		{ id: 3, value: 3 },
		{ id: 4, value: 4 },
		{ id: 5, value: 5 },
		{ id: 6, value: 6 },
	]
}

module.exports = {
	rackCount: 64,
	channelCount: 128,
	midi: superrackMidiMap,
	httpSettings: { server: null, port: 8010, started: false },
	logLevel: 'error',
	hotPlugin: { type: 'cc', channel: 1, mapping: getHotPluginMapping(), emptyMapping: getEmptyTemplate(12) },
	hotSnapshot: { type: 'cc', channel: 2, mapping: getHotSnapshotMapping(), emptyMapping: getEmptyTemplate(6) },
	mapping: getEmptyTemplate,
}
